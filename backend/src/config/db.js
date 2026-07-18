const { Pool } = require('pg');
require('dotenv').config();

// Fallback logic for connection configurations
const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({
  connectionString,
  // Add SSL settings if connecting to Supabase (in production or with DB_SSL enabled)
  ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
  console.log('Database connection pool established successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});

// Self-healing table migrations: Ensure backups table, updated constraints, and audit logs exist without dropping any data
const initMigrations = async () => {
  try {
    // 1. Ensure backups table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS backups (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          filename VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Update attendance status check constraint
    await pool.query(`
      ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
      ALTER TABLE attendance ADD CONSTRAINT attendance_status_check CHECK (status IN ('Present', 'Absent', 'Medical Leave', 'Holiday', 'On Duty'));
    `);

    // 3. Ensure audit_logs table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(100) NOT NULL,
          details TEXT,
          ip_address VARCHAR(45),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Ensure schedule_adjustments table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedule_adjustments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          department VARCHAR(100) NOT NULL,
          semester INT NOT NULL,
          date DATE NOT NULL,
          period INT NOT NULL,
          original_subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
          adjusted_subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
          adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('substitution', 'swap', 'extra', 'cancel')),
          remarks TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(department, semester, date, period)
      );
    `);

    // 5. Ensure total_periods column exists in subjects table
    await pool.query(`
      ALTER TABLE subjects ADD COLUMN IF NOT EXISTS total_periods INT DEFAULT 45;
    `);

    // 6. Ensure custom reminder columns exist in settings table
    await pool.query(`
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS daily_reminders BOOLEAN DEFAULT TRUE;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS email_timer VARCHAR(10) DEFAULT '18:00';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS low_attendance_warnings BOOLEAN DEFAULT TRUE;
    `);

    // 7. Ensure email_queue table exists
    await pool.query(`
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

    // 8. Ensure indexes for performance optimization exist
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_email_queue_active ON email_queue(status, retry_count) WHERE status IN ('pending', 'failed');
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_timetable_user_day ON timetable(user_id, day);
    `);

    console.log('Database self-healing table checks completed.');
  } catch (error) {
    console.error('Error during database self-healing migration:', error.message);
  }
};
initMigrations();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
