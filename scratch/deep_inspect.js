const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase') || connectionString.includes('pooler') ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    console.log('--- DB INSPECTION START ---');
    
    // 1. Table schema check for subjects & attendance
    const subjectsColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'subjects'
    `);
    console.log('\n--- SUBJECTS COLUMNS ---');
    console.table(subjectsColumns.rows);

    const attendanceColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'attendance'
    `);
    console.log('\n--- ATTENDANCE COLUMNS ---');
    console.table(attendanceColumns.rows);

    // 2. Users count & sample users
    const users = await pool.query("SELECT id, name, email, role, department, department_id, semester FROM users LIMIT 10");
    console.log('\n--- SAMPLE USERS ---');
    console.table(users.rows);

    // 3. Subjects list for a sample student user
    if (users.rows.length > 0) {
      const sampleUser = users.rows.find(u => u.role === 'student') || users.rows[0];
      console.log(`\n--- TESTING SUBJECT QUERY FOR USER: ${sampleUser.name} (${sampleUser.id}) | Dept: ${sampleUser.department} | DeptId: ${sampleUser.department_id} | Sem: ${sampleUser.semester} ---`);
      
      const userSubjects = await pool.query(`
        SELECT s.id, 
               COALESCE(s.subject_code, s.code) AS subject_code, 
               COALESCE(s.subject_name, s.name) AS subject_name, 
               s.credits, s.color, s.total_periods, s.department_id, s.department, s.semester, s.user_id, s.created_at
        FROM users u
        JOIN subjects s ON (s.department_id = u.department_id OR (u.department_id IS NULL AND s.department = u.department) OR s.user_id = u.id)
                        AND (s.semester = u.semester OR s.user_id = u.id)
        WHERE u.id = $1
        ORDER BY COALESCE(s.subject_name, s.name) ASC
      `, [sampleUser.id]);
      console.table(userSubjects.rows);

      // Check current attendance repository query for this user
      const repoSubjects = await pool.query(`
        SELECT s.id, 
               COALESCE(s.subject_code, s.code) AS subject_code, 
               COALESCE(s.subject_name, s.name) AS subject_name, 
               s.credits, s.color, s.total_periods, s.department_id, s.semester, s.created_at
        FROM users u
        JOIN subjects s ON (s.department_id = u.department_id OR (u.department_id IS NULL AND s.department = u.department))
                        AND s.semester = u.semester
        WHERE u.id = $1
        ORDER BY COALESCE(s.subject_name, s.name) ASC
      `, [sampleUser.id]);
      console.log(`\n--- CURRENT REPO SUBJECTS COUNT FOR USER: ${repoSubjects.rows.length} ---`);
      console.table(repoSubjects.rows);

      // 4. Check attendance records for this user
      const attendanceRecords = await pool.query(`
        SELECT a.id, a.user_id, a.subject_id, a.date, a.status, a.remarks, a.created_at,
               s.subject_code, s.subject_name, s.name, s.code
        FROM attendance a
        LEFT JOIN subjects s ON a.subject_id = s.id
        WHERE a.user_id = $1
        ORDER BY a.date DESC, a.created_at DESC
        LIMIT 20
      `, [sampleUser.id]);
      console.log(`\n--- ATTENDANCE RECORDS FOR USER (${attendanceRecords.rows.length}) ---`);
      console.table(attendanceRecords.rows);

      // 5. Check Subject Stats query for this user
      const subjectStats = await pool.query(`
        SELECT 
          s.id AS subject_id,
          COALESCE(s.subject_code, s.code) AS subject_code,
          COALESCE(s.subject_name, s.name) AS subject_name,
          s.credits,
          s.color,
          s.total_periods,
          COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0)::int AS present_count,
          COALESCE(SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END), 0)::int AS absent_count,
          COALESCE(SUM(CASE WHEN a.status = 'Medical Leave' THEN 1 ELSE 0 END), 0)::int AS medical_count,
          COALESCE(SUM(CASE WHEN a.status = 'Holiday' THEN 1 ELSE 0 END), 0)::int AS holiday_count,
          COALESCE(SUM(CASE WHEN a.status IN ('Present', 'Absent', 'On Duty') THEN 1 ELSE 0 END), 0)::int AS conducted_count
        FROM users u
        JOIN subjects s ON (s.department_id = u.department_id OR (u.department_id IS NULL AND s.department = u.department))
                        AND s.semester = u.semester
        LEFT JOIN attendance a ON s.id = a.subject_id AND a.user_id = u.id
        WHERE u.id = $1
        GROUP BY s.id, s.subject_code, s.code, s.subject_name, s.name, s.credits, s.color, s.total_periods
        ORDER BY COALESCE(s.subject_name, s.name) ASC
      `, [sampleUser.id]);
      console.log('\n--- SUBJECT STATS RESULT ---');
      console.table(subjectStats.rows);
    }

    // 6. Check duplicates in subjects table overall
    const duplicateSubjects = await pool.query(`
      SELECT COALESCE(subject_code, code) as code, COALESCE(subject_name, name) as name, department_id, department, semester, user_id, COUNT(*)
      FROM subjects
      GROUP BY COALESCE(subject_code, code), COALESCE(subject_name, name), department_id, department, semester, user_id
      HAVING COUNT(*) > 1
    `);
    console.log('\n--- DUPLICATE SUBJECTS IN DB ---');
    console.table(duplicateSubjects.rows);

  } catch (err) {
    console.error('Error during inspection:', err);
  } finally {
    await pool.end();
  }
}

main();
