const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.BACKUP_DATABASE_URL;

if (!connectionString) {
  console.warn('[BACKUP DB WARNING]: BACKUP_DATABASE_URL is not configured in .env file. Remote backup capabilities will be disabled.');
}

const pool = connectionString
  ? new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false }
    })
  : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('[BACKUP DB POOL ERROR]: Unexpected error on idle database client:', err.message);
  });
}

const initBackupMigrations = async () => {
  if (!pool) return;
  
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. backups (Version logs)
    await client.query(`
      CREATE TABLE IF NOT EXISTS backups (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          version_name VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. backup_departments
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_departments (
          backup_id UUID REFERENCES backups(id) ON DELETE CASCADE,
          id UUID NOT NULL,
          code VARCHAR(50),
          name VARCHAR(255),
          created_at TIMESTAMP,
          PRIMARY KEY (backup_id, id)
      );
      ALTER TABLE backup_departments ALTER COLUMN code DROP NOT NULL;
      ALTER TABLE backup_departments ALTER COLUMN name DROP NOT NULL;
    `);

    // 3. backup_users
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_users (
          backup_id UUID REFERENCES backups(id) ON DELETE CASCADE,
          id UUID NOT NULL,
          name VARCHAR(255),
          register_number VARCHAR(50),
          email VARCHAR(255),
          password_hash VARCHAR(255),
          role VARCHAR(50),
          department VARCHAR(100),
          department_id UUID,
          semester INT,
          is_approved BOOLEAN,
          is_suspended BOOLEAN,
          google_id VARCHAR(255),
          otp_code VARCHAR(6),
          otp_expires TIMESTAMP,
          reset_password_token VARCHAR(255),
          reset_password_expires TIMESTAMP,
          avatar VARCHAR(255),
          created_at TIMESTAMP,
          updated_at TIMESTAMP,
          last_login TIMESTAMP,
          PRIMARY KEY (backup_id, id)
      );
      ALTER TABLE backup_users ALTER COLUMN name DROP NOT NULL;
      ALTER TABLE backup_users ALTER COLUMN email DROP NOT NULL;
      ALTER TABLE backup_users ALTER COLUMN password_hash DROP NOT NULL;
      ALTER TABLE backup_users ALTER COLUMN role DROP NOT NULL;
      ALTER TABLE backup_users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6);
      ALTER TABLE backup_users ADD COLUMN IF NOT EXISTS otp_expires TIMESTAMP;
      ALTER TABLE backup_users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255);
      ALTER TABLE backup_users ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP;
      ALTER TABLE backup_users ADD COLUMN IF NOT EXISTS avatar VARCHAR(255);
    `);

    // 4. backup_subjects
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_subjects (
          backup_id UUID REFERENCES backups(id) ON DELETE CASCADE,
          id UUID NOT NULL,
          code VARCHAR(50),
          subject_code VARCHAR(50),
          name VARCHAR(255),
          subject_name VARCHAR(255),
          department VARCHAR(100),
          department_id UUID,
          semester INT,
          color VARCHAR(50),
          credits INT,
          total_periods INT,
          user_id UUID,
          created_at TIMESTAMP,
          PRIMARY KEY (backup_id, id)
      );
    `);

    // 5. backup_timetable
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_timetable (
          backup_id UUID REFERENCES backups(id) ON DELETE CASCADE,
          id UUID NOT NULL,
          department_id UUID,
          department VARCHAR(100),
          semester INT,
          day VARCHAR(20),
          period INT,
          subject_id UUID,
          start_time VARCHAR(10),
          end_time VARCHAR(10),
          room VARCHAR(50),
          expires_at TIMESTAMP,
          created_at TIMESTAMP,
          PRIMARY KEY (backup_id, id)
      );
      ALTER TABLE backup_timetable ALTER COLUMN semester DROP NOT NULL;
      ALTER TABLE backup_timetable ALTER COLUMN day DROP NOT NULL;
      ALTER TABLE backup_timetable ALTER COLUMN period DROP NOT NULL;
      ALTER TABLE backup_timetable ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
    `);

    // 6. backup_attendance
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_attendance (
          backup_id UUID REFERENCES backups(id) ON DELETE CASCADE,
          id UUID NOT NULL,
          user_id UUID,
          subject_id UUID,
          date DATE,
          period INT,
          status VARCHAR(50),
          remarks TEXT,
          created_at TIMESTAMP,
          PRIMARY KEY (backup_id, id)
      );
      ALTER TABLE backup_attendance ALTER COLUMN user_id DROP NOT NULL;
      ALTER TABLE backup_attendance ALTER COLUMN date DROP NOT NULL;
      ALTER TABLE backup_attendance ALTER COLUMN period DROP NOT NULL;
      ALTER TABLE backup_attendance ALTER COLUMN status DROP NOT NULL;
    `);

    // 7. backup_settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_settings (
          backup_id UUID REFERENCES backups(id) ON DELETE CASCADE,
          id UUID NOT NULL,
          user_id UUID,
          minimum_attendance INT,
          theme VARCHAR(20),
          notifications BOOLEAN,
          daily_reminders BOOLEAN,
          email_timer VARCHAR(10),
          low_attendance_warnings BOOLEAN,
          updated_at TIMESTAMP,
          PRIMARY KEY (backup_id, id)
      );
    `);

    // 8. backup_system_settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_system_settings (
          backup_id UUID REFERENCES backups(id) ON DELETE CASCADE,
          key VARCHAR(100) NOT NULL,
          value TEXT,
          updated_at TIMESTAMP,
          PRIMARY KEY (backup_id, key)
      );
    `);

    // 9. backup_holidays
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_holidays (
          backup_id UUID REFERENCES backups(id) ON DELETE CASCADE,
          id UUID NOT NULL,
          name VARCHAR(255),
          date DATE,
          department_id UUID,
          department VARCHAR(100),
          semester INT,
          created_at TIMESTAMP,
          PRIMARY KEY (backup_id, id)
      );
      ALTER TABLE backup_holidays ALTER COLUMN name DROP NOT NULL;
      ALTER TABLE backup_holidays ALTER COLUMN date DROP NOT NULL;
    `);

    // 10. backup_schedule_adjustments
    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_schedule_adjustments (
          backup_id UUID REFERENCES backups(id) ON DELETE CASCADE,
          id UUID NOT NULL,
          department_id UUID,
          department VARCHAR(100),
          semester INT,
          date DATE,
          period INT,
          original_subject_id UUID,
          adjusted_subject_id UUID,
          adjustment_type VARCHAR(20),
          remarks TEXT,
          created_at TIMESTAMP,
          PRIMARY KEY (backup_id, id)
      );
      ALTER TABLE backup_schedule_adjustments ALTER COLUMN semester DROP NOT NULL;
      ALTER TABLE backup_schedule_adjustments ALTER COLUMN date DROP NOT NULL;
      ALTER TABLE backup_schedule_adjustments ALTER COLUMN period DROP NOT NULL;
      ALTER TABLE backup_schedule_adjustments ALTER COLUMN adjustment_type DROP NOT NULL;
    `);

    await client.query('COMMIT');
    console.log('[BACKUP DB]: Remote relational backup tables initialized successfully.');
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (e) {}
    }
    console.error('[BACKUP DB CRITICAL]: Error during remote backup migrations:', error.message);
  } finally {
    if (client) {
      client.release();
    }
  }
};

initBackupMigrations();

module.exports = {
  query: (text, params) => {
    if (!pool) throw new Error('Backup database connection pool is not initialized.');
    return pool.query(text, params);
  },
  pool
};
