const { Pool } = require('pg');

const SUPABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.xjmruzikomdudigfegyo:.trackme%40321.@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: SUPABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false }
});

async function runProductionMigration() {
  console.log('==================================================');
  console.log('  🚀 SAFE PRODUCTION MIGRATION RUNNER (SUPABASE)');
  console.log('==================================================');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('🔄 Step 1/5: Initializing departments table & dynamic seeding...');
    
    // Enable pgcrypto extension for UUID generation
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // Ensure departments table exists
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

    console.log('🔄 Step 2/5: Backfilling users.department_id foreign key...');
    await client.query(`
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

    console.log('🔄 Step 3/5: Backfilling subjects.department_id foreign key...');
    await client.query(`
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

    console.log('🔄 Step 4/5: Migrating timetable to pure department-based schedule...');
    await client.query(`
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

    // Deduplicate timetable before dropping user_id column
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

    console.log('🔄 Step 5/5: Remapping attendance logs & creating performance indexes...');
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

    await client.query(`
      UPDATE attendance a
      SET subject_id = master_sub.id
      FROM subjects old_sub
      JOIN users u ON old_sub.user_id = u.id
      JOIN subjects master_sub ON (master_sub.department_id = u.department_id OR TRIM(UPPER(master_sub.department)) = TRIM(UPPER(u.department)))
                              AND master_sub.semester = u.semester
                              AND TRIM(UPPER(COALESCE(master_sub.subject_code, master_sub.subject_name))) = TRIM(UPPER(COALESCE(old_sub.subject_code, old_sub.subject_name)))
                              AND master_sub.user_id IS NULL
      WHERE a.subject_id = old_sub.id AND old_sub.user_id IS NOT NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
      CREATE INDEX IF NOT EXISTS idx_timetable_dept_sem ON timetable(department_id, semester, day);
      CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_attendance_user_subject ON attendance(user_id, subject_id);
    `);

    await client.query('COMMIT');
    console.log('\n==================================================');
    console.log('  ✅ PRODUCTION SUPABASE MIGRATION COMPLETED!');
    console.log('==================================================\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ MIGRATION ROLLBACK TRIGGERED:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runProductionMigration();
