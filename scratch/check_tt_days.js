const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
});

async function checkTimetableDays() {
  try {
    const res = await pool.query(`SELECT DISTINCT day FROM timetable;`);
    console.log('Distinct timetable days:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkTimetableDays();
