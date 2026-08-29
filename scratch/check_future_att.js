const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
});

async function checkFutureAttendance() {
  try {
    const res = await pool.query(`
      SELECT TO_CHAR(date, 'YYYY-MM-DD') as date_str, status, count(*) 
      FROM attendance 
      WHERE date >= '2026-08-25' 
      GROUP BY date, status 
      ORDER BY date ASC;
    `);
    console.log('Attendance records after 2026-08-24:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkFutureAttendance();
