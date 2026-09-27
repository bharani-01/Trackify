const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function run() {
  try {
    const res = await pool.query(
      `SELECT id, name, TO_CHAR(date, 'YYYY-MM-DD') as date, TO_CHAR(date, 'Day') as day, department, semester
       FROM holidays
       ORDER BY date ASC`
    );
    console.log('=== ALL HOLIDAYS IN DATABASE ===');
    res.rows.forEach(r => {
      console.log(`${r.date} (${r.day.trim()}): ${r.name} [Dept: ${r.department || 'ALL'}, Sem: ${r.semester || 'ALL'}]`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
