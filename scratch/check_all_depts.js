const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase') || connectionString.includes('pooler') ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    console.log('--- CHECKING DUPLICATE SUBJECTS ACROSS ALL DEPTS & SEMESTERS ---');
    const duplicates = await pool.query(`
      SELECT 
        COALESCE(department_id::text, department) as dept,
        semester,
        COALESCE(subject_code, code) as subject_code,
        COALESCE(subject_name, name) as subject_name,
        COUNT(*) as count,
        array_agg(id) as ids,
        array_agg(created_at) as created_dates
      FROM subjects
      GROUP BY COALESCE(department_id::text, department), semester, COALESCE(subject_code, code), COALESCE(subject_name, name)
      HAVING COUNT(*) > 1
      ORDER BY dept, semester, subject_code
    `);
    console.log(`Found ${duplicates.rows.length} duplicate subject groups:`);
    console.table(duplicates.rows);

    console.log('\n--- CHECKING TIMETABLE REFERENCES ---');
    const ttRef = await pool.query(`
      SELECT t.subject_id, s.subject_code, s.department, s.semester, s.created_at, COUNT(t.id) as slot_count
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.id
      GROUP BY t.subject_id, s.subject_code, s.department, s.semester, s.created_at
      ORDER BY s.department, s.semester, s.subject_code
    `);
    console.table(ttRef.rows);

    console.log('\n--- CHECKING ATTENDANCE REFERENCES ---');
    const attRef = await pool.query(`
      SELECT a.subject_id, s.subject_code, s.department, s.semester, s.created_at, COUNT(a.id) as record_count
      FROM attendance a
      JOIN subjects s ON a.subject_id = s.id
      GROUP BY a.subject_id, s.subject_code, s.department, s.semester, s.created_at
      ORDER BY s.department, s.semester, s.subject_code
    `);
    console.table(attRef.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
