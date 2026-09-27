const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function run() {
  try {
    const saiRes = await pool.query(
      "SELECT id FROM users WHERE email = 'saividya2007@gmail.com'"
    );
    const userId = saiRes.rows[0].id;

    const res = await pool.query(
      `SELECT a.id, TO_CHAR(a.date, 'YYYY-MM-DD') as date, TO_CHAR(a.date, 'Dy') as day,
              a.status, a.remarks, s.subject_code, s.subject_name
       FROM attendance a
       JOIN subjects s ON a.subject_id = s.id
       WHERE a.user_id = $1 AND a.date IN ('2026-07-20', '2026-07-27')
       ORDER BY a.date, a.remarks`,
      [userId]
    );

    console.log('=== SAI VIDYA ON JULY 20 AND JULY 27 ===');
    console.log(res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
