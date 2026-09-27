const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function run() {
  try {
    const ttRes = await pool.query(
      `SELECT t.*, COALESCE(s.subject_code, s.code) as code, COALESCE(s.subject_name, s.name) as name
       FROM timetable t
       LEFT JOIN subjects s ON t.subject_id = s.id
       ORDER BY t.department, t.semester, t.day, t.period`
    );

    console.log(`=== ALL TIMETABLE SLOTS IN DB (${ttRes.rows.length} total) ===`);
    ttRes.rows.forEach(r => {
      console.log(`[Dept: ${r.department || r.department_id}, Sem: ${r.semester}] ${r.day} P${r.period} (${r.start_time}-${r.end_time}): [${r.code}] ${r.name}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
