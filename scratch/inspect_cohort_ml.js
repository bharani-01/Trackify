const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function run() {
  try {
    const userRes = await pool.query(
      "SELECT id, register_number, email, name, department, semester FROM users WHERE email = 'saividya2007@gmail.com'"
    );
    const user = userRes.rows[0];

    // All logs for AIM23CL302
    const labLogs = await pool.query(
      `SELECT a.id, TO_CHAR(a.date, 'YYYY-MM-DD') as date, TO_CHAR(a.date, 'Day') as day_name,
              a.subject_id, s.subject_code, s.subject_name,
              a.status, a.remarks, a.created_at
       FROM attendance a
       JOIN subjects s ON a.subject_id = s.id
       WHERE a.user_id = $1 AND s.subject_code = 'AIM23CL302'
       ORDER BY a.date ASC, a.remarks ASC`,
      [user.id]
    );

    console.log(`=== ALL ATTENDANCE LOGS FOR AIM23CL302 (${labLogs.rows.length} records) ===`);
    labLogs.rows.forEach(r => {
      console.log(`ID: ${r.id} | Date: ${r.date} (${r.day_name.trim()}) | Status: ${r.status} | Remarks: ${r.remarks} | CreatedAt: ${r.created_at}`);
    });

    // Also all logs for AIM23CT302 (Theory)
    const theoryLogs = await pool.query(
      `SELECT a.id, TO_CHAR(a.date, 'YYYY-MM-DD') as date, TO_CHAR(a.date, 'Day') as day_name,
              a.subject_id, s.subject_code, s.subject_name,
              a.status, a.remarks, a.created_at
       FROM attendance a
       JOIN subjects s ON a.subject_id = s.id
       WHERE a.user_id = $1 AND s.subject_code = 'AIM23CT302'
       ORDER BY a.date ASC, a.remarks ASC`,
      [user.id]
    );

    console.log(`\n=== ALL ATTENDANCE LOGS FOR AIM23CT302 (${theoryLogs.rows.length} records) ===`);
    theoryLogs.rows.forEach(r => {
      console.log(`ID: ${r.id} | Date: ${r.date} (${r.day_name.trim()}) | Status: ${r.status} | Remarks: ${r.remarks} | CreatedAt: ${r.created_at}`);
    });

    // Check all students in E01 semester 5 to see what others have for AIM23CL302
    const cohortStats = await pool.query(
      `SELECT u.register_number, u.name, u.email,
              COUNT(a.id) filter (where s.subject_code = 'AIM23CL302') as lab_count,
              COUNT(a.id) filter (where s.subject_code = 'AIM23CT302') as theory_count
       FROM users u
       LEFT JOIN attendance a ON u.id = a.user_id
       LEFT JOIN subjects s ON a.subject_id = s.id
       WHERE u.department = $1 AND u.semester = $2
       GROUP BY u.id, u.register_number, u.name, u.email
       ORDER BY u.register_number`,
      [user.department, user.semester]
    );

    console.log(`\n=== COHORT STUDENTS STATS FOR ML LAB vs THEORY ===`);
    cohortStats.rows.forEach(c => {
      console.log(`${c.register_number} | ${c.name} (${c.email}): Lab=${c.lab_count}, Theory=${c.theory_count}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
