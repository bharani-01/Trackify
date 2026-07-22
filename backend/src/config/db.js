const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
  // DB connection pool established
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});

// Self-healing, zero-downtime database migrations: Bulletproof Relational Department Schema
const initMigrations = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. Enable pgcrypto extension for UUID generation
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // 1. Ensure departments table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Auto-link existing department codes present in actual user/subject data
    await client.query(`
      INSERT INTO departments (code, name)
      SELECT DISTINCT TRIM(UPPER(department)), TRIM(UPPER(department))
      FROM users
      WHERE department IS NOT NULL AND TRIM(department) != ''
      ON CONFLICT (code) DO NOTHING;

      INSERT INTO departments (code, name)
      SELECT DISTINCT TRIM(UPPER(department)), TRIM(UPPER(department))
      FROM subjects
      WHERE department IS NOT NULL AND TRIM(department) != ''
      ON CONFLICT (code) DO NOTHING;
    `);

    // 2. Ensure users table exists & backfill department_id with whitespace trimming
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          register_number VARCHAR(50) UNIQUE,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'student',
          department VARCHAR(100),
          department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
          semester INT,
          is_approved BOOLEAN DEFAULT TRUE,
          is_suspended BOOLEAN DEFAULT FALSE,
          google_id VARCHAR(255),
          otp_code VARCHAR(6),
          otp_expires TIMESTAMP,
          reset_password_token VARCHAR(255),
          reset_password_expires TIMESTAMP,
          avatar VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT TRUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;
    `);

    await client.query(`
      UPDATE users u
      SET department_id = d.id
      FROM departments d
      WHERE u.department IS NOT NULL 
        AND TRIM(UPPER(u.department)) = TRIM(UPPER(d.code)) 
        AND u.department_id IS NULL;
    `);

    // 3. Ensure subjects table exists & backfill department_id
    await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code VARCHAR(50) NOT NULL,
          subject_code VARCHAR(50),
          name VARCHAR(255),
          subject_name VARCHAR(255),
          department VARCHAR(100),
          department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
          semester INT NOT NULL DEFAULT 1,
          color VARCHAR(50) DEFAULT '#3b82f6',
          credits INT DEFAULT 3,
          total_periods INT DEFAULT 45,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE subjects ADD COLUMN IF NOT EXISTS code VARCHAR(50);
      ALTER TABLE subjects ADD COLUMN IF NOT EXISTS subject_code VARCHAR(50);
      ALTER TABLE subjects ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE subjects ADD COLUMN IF NOT EXISTS subject_name VARCHAR(255);
      ALTER TABLE subjects ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE CASCADE;
      ALTER TABLE subjects ADD COLUMN IF NOT EXISTS total_periods INT DEFAULT 45;
    `);

    await client.query(`
      UPDATE subjects s
      SET department_id = d.id
      FROM departments d
      WHERE s.department IS NOT NULL 
        AND TRIM(UPPER(s.department)) = TRIM(UPPER(d.code)) 
        AND s.department_id IS NULL;
    `);

    // 4. Ensure pure Department-Based timetable table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS timetable (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
          department VARCHAR(100),
          semester INT NOT NULL,
          day VARCHAR(20) NOT NULL,
          period INT NOT NULL,
          subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
          start_time VARCHAR(10),
          end_time VARCHAR(10),
          room VARCHAR(50),
          user_id UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE timetable ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE CASCADE;
    `);

    await client.query(`
      UPDATE timetable t
      SET department_id = d.id
      FROM departments d
      WHERE t.department IS NOT NULL 
        AND TRIM(UPPER(t.department)) = TRIM(UPPER(d.code)) 
        AND t.department_id IS NULL;
    `);

    // Deduplicate timetable before dropping user_id column to prevent unique constraint failures
    await client.query(`
      DELETE FROM timetable t1
      USING timetable t2
      WHERE t1.id > t2.id
        AND t1.department_id IS NOT NULL
        AND t1.department_id = t2.department_id
        AND t1.semester = t2.semester
        AND t1.day = t2.day
        AND t1.period = t2.period;
    `);

    // Safe drop legacy user_id column from timetable
    await client.query(`
      ALTER TABLE timetable DROP COLUMN IF EXISTS user_id;
    `);

    // 5. Ensure attendance table exists and remap legacy personal subject_ids to master subject_ids
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
          date DATE NOT NULL,
          period INT NOT NULL,
          status VARCHAR(50) NOT NULL CHECK (status IN ('Present', 'Absent', 'Medical Leave', 'Holiday', 'On Duty')),
          remarks TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, date, period)
      );
    `);

    // Remap attendance records to master department subjects if old data had cloned per-student subject rows
    await client.query(`
      UPDATE attendance a
      SET subject_id = master_sub.id
      FROM subjects old_sub
      JOIN users u ON old_sub.user_id = u.id
      JOIN subjects master_sub ON (master_sub.department_id = u.department_id OR TRIM(UPPER(master_sub.department)) = TRIM(UPPER(u.department)))
                              AND master_sub.semester = u.semester
                              AND (TRIM(UPPER(master_sub.subject_code)) = TRIM(UPPER(old_sub.subject_code)) OR TRIM(UPPER(master_sub.code)) = TRIM(UPPER(old_sub.code)))
                              AND master_sub.user_id IS NULL
      WHERE a.subject_id = old_sub.id AND old_sub.user_id IS NOT NULL;
    `);

    // 6. Ensure settings & system_settings tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          minimum_attendance INT DEFAULT 80,
          theme VARCHAR(20) DEFAULT 'light',
          notifications BOOLEAN DEFAULT TRUE,
          daily_reminders BOOLEAN DEFAULT TRUE,
          email_timer VARCHAR(10) DEFAULT '18:00',
          low_attendance_warnings BOOLEAN DEFAULT TRUE,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Ensure schedule_adjustments table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schedule_adjustments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
          department VARCHAR(100),
          semester INT NOT NULL,
          date DATE NOT NULL,
          period INT NOT NULL,
          original_subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
          adjusted_subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
          adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('substitution', 'swap', 'extra', 'cancel')),
          remarks TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE schedule_adjustments ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE CASCADE;
    `);

    // 8. Ensure holidays table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS holidays (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          date DATE NOT NULL,
          department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
          department VARCHAR(100),
          semester INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE holidays ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE CASCADE;
    `);

    // 9. Ensure audit_logs, backups, email_queue, announcements exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS announcements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          category VARCHAR(50) DEFAULT 'General',
          priority VARCHAR(20) DEFAULT 'normal',
          department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
          department VARCHAR(100),
          semester INT,
          posted_by UUID REFERENCES users(id) ON DELETE CASCADE,
          is_pinned BOOLEAN DEFAULT FALSE,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(100) NOT NULL,
          details TEXT,
          ip_address VARCHAR(45),
          device_type VARCHAR(50) DEFAULT 'desktop',
          is_bot BOOLEAN DEFAULT FALSE,
          bot_name VARCHAR(100),
          geo_location VARCHAR(255),
          user_agent TEXT,
          resolved BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device_type VARCHAR(50) DEFAULT 'desktop';
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE;
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS bot_name VARCHAR(100);
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS geo_location VARCHAR(255);
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

      CREATE TABLE IF NOT EXISTS backups (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          filename VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_queue (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          recipient_email VARCHAR(100) NOT NULL,
          recipient_name VARCHAR(100) NOT NULL,
          subject VARCHAR(200) NOT NULL,
          html_content TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
          retry_count INT DEFAULT 0,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 10. Performance Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
      CREATE INDEX IF NOT EXISTS idx_timetable_dept_sem ON timetable(department_id, semester, day);
      CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_attendance_user_subject ON attendance(user_id, subject_id);
      CREATE INDEX IF NOT EXISTS idx_announcements_dept_sem ON announcements(department_id, semester, is_pinned, created_at);
    `);

    await client.query('COMMIT');
    console.log('Database relational schema migrations initialized successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during database relational migration:', error.message);
  } finally {
    client.release();
  }
};

initMigrations();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
