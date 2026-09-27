const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function run() {
  try {
    const res = await pool.query(
      `SELECT u.register_number, u.name, TO_CHAR(a.date, 'YYYY-MM-DD') as date, TO_CHAR(a.date, 'Dy') as day_name,
              s.subject_code, s.subject_name, a.remarks, a.status, a.created_at
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       JOIN subjects s ON a.subject_id = s.id
       WHERE s.subject_code = 'AIM23CL302' AND TO_CHAR(a.date, 'Dy') IN ('Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')
       ORDER BY a.date, u.register_number`
    );

    console.log(`=== ALL NON-MONDAY ML LAB ATTENDANCE RECORDS ACROSS ALL STUDENTS (${res.rows.length} total) ===`);
    res.rows.forEach(r => {
      console.log(`${r.register_number} | ${r.name} | ${r.date} (${r.day_name}): ${r.remarks} | ${r.status} | Logged: ${r.created_at.toISOString()}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
