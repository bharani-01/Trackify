const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function run() {
  try {
    const userRes = await pool.query(
      "SELECT id, register_number, email, name, department, department_id, semester FROM users WHERE email = 'saividya2007@gmail.com'"
    );
    const user = userRes.rows[0];

    // Check department timetable entries
    const deptTt = await pool.query(
      `SELECT t.*, s.subject_code, s.subject_name
       FROM timetable t
       JOIN subjects s ON t.subject_id = s.id
       WHERE (t.department = $1 OR t.department_id = $2) AND t.semester = $3
       ORDER BY 
         CASE t.day 
           WHEN 'Monday' THEN 1 
           WHEN 'Tuesday' THEN 2 
           WHEN 'Wednesday' THEN 3 
           WHEN 'Thursday' THEN 4 
           WHEN 'Friday' THEN 5 
           WHEN 'Saturday' THEN 6 
           ELSE 7 
         END, t.period`,
      [user.department, user.department_id, user.semester]
    );
    console.log(`Department timetable entries: ${deptTt.rows.length}`);
    deptTt.rows.forEach(r => {
      console.log(`${r.day} P${r.period} (${r.start_time}-${r.end_time}): [${r.subject_code}] ${r.subject_name}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
