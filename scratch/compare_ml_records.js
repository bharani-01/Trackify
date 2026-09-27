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

    const hariRes = await pool.query("SELECT id FROM users WHERE register_number = 'E0124053'");
    const hariId = hariRes.rows[0].id;

    const saiLogs = await pool.query(
      `SELECT a.id, TO_CHAR(a.date, 'YYYY-MM-DD') as date, TO_CHAR(a.date, 'Dy') as day_name,
              s.subject_code, s.subject_name, a.status, a.remarks, a.created_at
       FROM attendance a
       JOIN subjects s ON a.subject_id = s.id
       WHERE a.user_id = $1 AND s.subject_code IN ('AIM23CL302', 'AIM23CT302')
       ORDER BY a.date ASC, a.remarks ASC`,
      [saiId]
    );

    const hariLogs = await pool.query(
      `SELECT a.id, TO_CHAR(a.date, 'YYYY-MM-DD') as date, TO_CHAR(a.date, 'Dy') as day_name,
              s.subject_code, s.subject_name, a.status, a.remarks, a.created_at
       FROM attendance a
       JOIN subjects s ON a.subject_id = s.id
       WHERE a.user_id = $1 AND s.subject_code IN ('AIM23CL302', 'AIM23CT302')
       ORDER BY a.date ASC, a.remarks ASC`,
      [hariId]
    );

    console.log('=== SAI VIDYA M (ALL 67 ML RECORDS) ===');
    saiLogs.rows.forEach(r => {
      console.log(`[Sai] ${r.date} (${r.day_name.trim()}): ${r.subject_code} | ${r.remarks} | ${r.status} | Created: ${r.created_at.toISOString()}`);
    });

    console.log('\n=== HARI KRISHNAN GS (ALL 57 ML RECORDS) ===');
    hariLogs.rows.forEach(r => {
      console.log(`[Hari] ${r.date} (${r.day_name.trim()}): ${r.subject_code} | ${r.remarks} | ${r.status} | Created: ${r.created_at.toISOString()}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
