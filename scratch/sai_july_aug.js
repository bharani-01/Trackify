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

    // Group logs by date in July/August
    const logs = await pool.query(
      `SELECT TO_CHAR(a.date, 'YYYY-MM-DD') as date, TO_CHAR(a.date, 'Dy') as day_name,
              a.remarks, s.subject_code, s.subject_name, a.status, a.created_at
       FROM attendance a
       JOIN subjects s ON a.subject_id = s.id
       WHERE a.user_id = $1 AND a.date < '2026-08-25'
       ORDER BY a.date, a.remarks`,
      [saiId]
    );

    const byDate = {};
    logs.rows.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = { day: r.day_name.trim(), slots: [], created_at: r.created_at };
      byDate[r.date].slots.push(`[${r.remarks}] ${r.subject_code} (${r.status})`);
    });

    console.log('=== SAI VIDYA M ATTENDANCE LOGS (JULY - MID AUG) ===');
    Object.keys(byDate).forEach(d => {
      console.log(`\nDate: ${d} (${byDate[d].day}) [Logged at ${byDate[d].created_at.toISOString()}]:`);
      byDate[d].slots.forEach(s => console.log(`   - ${s}`));
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
