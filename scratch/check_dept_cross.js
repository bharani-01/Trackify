const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase') || connectionString.includes('pooler') ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    console.log('--- ALL DEPARTMENTS IN DB ---');
    const depts = await pool.query('SELECT * FROM departments');
    console.table(depts.rows);

    console.log('\n--- SAMPLE USERS FROM EACH DEPARTMENT ---');
    const users = await pool.query(`
      SELECT DISTINCT ON (department) id, name, email, department, department_id, semester 
      FROM users 
      WHERE role = 'student' AND department IS NOT NULL
    `);
    console.table(users.rows);

    for (const u of users.rows) {
      console.log(`\n==================================================`);
      console.log(`USER: ${u.name} | Dept: ${u.department} | DeptId: ${u.department_id} | Sem: ${u.semester}`);
      
      const subs = await pool.query(`
        SELECT s.id, 
               COALESCE(s.subject_code, s.code) AS code, 
               COALESCE(s.subject_name, s.name) AS name, 
               s.department, s.department_id, s.semester, s.user_id, s.created_at
        FROM users u
        JOIN subjects s ON (
          s.department_id = u.department_id 
          OR (u.department_id IS NULL AND s.department = u.department)
          OR (s.department_id IS NULL AND s.department = u.department)
          OR s.user_id = u.id
        )
        AND s.semester = u.semester
        WHERE u.id = $1
        ORDER BY code ASC
      `, [u.id]);
      
      console.log(`Total subjects returned by JOIN: ${subs.rows.length}`);
      console.table(subs.rows);
    }

    console.log('\n--- SUBJECTS WITH NULL DEPARTMENT OR NULL DEPARTMENT_ID ---');
    const nullDeptSubs = await pool.query(`
      SELECT id, COALESCE(subject_code, code) as code, COALESCE(subject_name, name) as name, department, department_id, semester, user_id
      FROM subjects
      WHERE department IS NULL OR department_id IS NULL
    `);
    console.table(nullDeptSubs.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
