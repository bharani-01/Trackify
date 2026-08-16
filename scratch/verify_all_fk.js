const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase') || connectionString.includes('pooler') ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    console.log('=== RIGOROUS SYSTEM VERIFICATION FOR SUBJECT DEPENDENCIES ===\n');

    // 1. Find all Foreign Keys pointing to the 'subjects' table
    const fkQuery = `
      SELECT
        tc.table_schema, 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_name = 'subjects';
    `;
    const fkResult = await pool.query(fkQuery);
    console.log('--- ALL FOREIGN KEYS POINTING TO "subjects" TABLE ---');
    console.table(fkResult.rows);

    // 2. Check all tables having a column with "subject" in its name
    const colsQuery = `
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE column_name LIKE '%subject%'
      ORDER BY table_name, column_name;
    `;
    const colsResult = await pool.query(colsQuery);
    console.log('\n--- ALL COLUMNS IN DB NAMED "*subject*" ---');
    console.table(colsResult.rows);

    // 3. Count records referencing duplicate subject IDs across all these tables
    const dupSubjectIdsQuery = `
      SELECT id, subject_code, subject_name, department, semester, created_at
      FROM (
        SELECT id, COALESCE(subject_code, code) as subject_code, COALESCE(subject_name, name) as subject_name,
               department, semester, created_at,
               ROW_NUMBER() OVER (
                 PARTITION BY COALESCE(department_id::text, department), semester, UPPER(COALESCE(subject_code, code))
                 ORDER BY created_at ASC, id ASC
               ) as rn
        FROM subjects
      ) t
      WHERE rn > 1;
    `;
    const dupSubjects = await pool.query(dupSubjectIdsQuery);
    console.log(`\nFound ${dupSubjects.rows.length} DUPLICATE subject rows to be merged:`);
    console.table(dupSubjects.rows);

    const dupIds = dupSubjects.rows.map(s => s.id);
    if (dupIds.length > 0) {
      // Check attendance
      const attCount = await pool.query('SELECT COUNT(*) FROM attendance WHERE subject_id = ANY($1)', [dupIds]);
      console.log(`Attendance records tied to duplicate subject IDs: ${attCount.rows[0].count}`);

      // Check timetable
      const ttCount = await pool.query('SELECT COUNT(*) FROM timetable WHERE subject_id = ANY($1)', [dupIds]);
      console.log(`Timetable slots tied to duplicate subject IDs: ${ttCount.rows[0].count}`);

      // Check schedule_adjustments
      const saOrigCount = await pool.query('SELECT COUNT(*) FROM schedule_adjustments WHERE original_subject_id = ANY($1)', [dupIds]);
      const saAdjCount = await pool.query('SELECT COUNT(*) FROM schedule_adjustments WHERE adjusted_subject_id = ANY($1)', [dupIds]);
      console.log(`Schedule adjustments (original) tied to duplicate subject IDs: ${saOrigCount.rows[0].count}`);
      console.log(`Schedule adjustments (adjusted) tied to duplicate subject IDs: ${saAdjCount.rows[0].count}`);
    }

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await pool.end();
  }
}

main();
