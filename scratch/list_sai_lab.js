const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function run() {
  try {
    const saiRes = await pool.query("SELECT id FROM users WHERE email = 'saividya2007@gmail.com'");
    const saiId = saiRes.rows[0].id;

    const saiLabLogs = await pool.query(
      `SELECT a.id, TO_CHAR(a.date, 'YYYY-MM-DD') as date, TO_CHAR(a.date, 'Day') as day_name,
              s.subject_code, s.subject_name, a.status, a.remarks, a.created_at
       FROM attendance a
       JOIN subjects s ON a.subject_id = s.id
       WHERE a.user_id = $1 AND s.subject_code = 'AIM23CL302'
       ORDER BY a.date ASC, a.created_at ASC`,
      [saiId]
    );

    console.log(`=== ALL 38 LAB RECORDS FOR SAI VIDYA M (AIM23CL302) ===`);
    saiLabLogs.rows.forEach((r, idx) => {
      console.log(`${idx + 1}. ID: ${r.id} | Date: ${r.date} (${r.day_name.trim()}) | Remarks: "${r.remarks}" | Status: ${r.status} | CreatedAt: ${r.created_at.toISOString()}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
