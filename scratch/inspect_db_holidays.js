const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
});

async function inspect() {
  try {
    const holidays = await pool.query("SELECT id, name, TO_CHAR(date, 'YYYY-MM-DD') as date_str, department, semester FROM holidays ORDER BY date ASC;");
    console.log('--- CURRENT HOLIDAYS IN DB ---');
    console.table(holidays.rows);

    const depts = await pool.query("SELECT id, code, name FROM departments;");
    console.log('\n--- DEPARTMENTS ---');
    console.table(depts.rows);

    const users = await pool.query("SELECT role, count(*) FROM users GROUP BY role;");
    console.log('\n--- USERS BY ROLE ---');
    console.table(users.rows);

    const attendance = await pool.query("SELECT min(date) as min_date, max(date) as max_date, count(*) FROM attendance;");
    console.log('\n--- ATTENDANCE RANGE ---');
    console.table(attendance.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspect();
