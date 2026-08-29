const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
});

async function checkHolidayAttendance() {
  const dates = [
    '2026-08-26', // Milad-un-Nabi
    '2026-09-12', // 2nd Saturday
    '2026-09-14', // Vinayakar Chathurthi
    '2026-09-26', // 4th Saturday
    '2026-10-02', // Gandhi Jayanthi
    '2026-10-10', // 2nd Saturday
    '2026-10-19', // Ayutha Pooja
    '2026-10-20', // Vijaya Dasami
    '2026-10-24', // 4th Saturday
    '2026-11-14', // 2nd Saturday
    '2026-11-28'  // 4th Saturday
  ];

  try {
    const res = await pool.query(
      `SELECT TO_CHAR(date, 'YYYY-MM-DD') as date_str, count(*) as count 
       FROM attendance 
       WHERE date = ANY($1::date[]) 
       GROUP BY date 
       ORDER BY date ASC;`,
      [dates]
    );
    console.log('Attendance on upcoming holiday dates:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkHolidayAttendance();
