const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function checkDepts() {
  try {
    const users = await pool.query('SELECT id, register_number, name, department, department_id, semester FROM users WHERE role = $1 ORDER BY register_number', ['student']);
    console.log('=== USERS DEPT FORMAT ===');
    console.table(users.rows.slice(0, 15));

    const depts = await pool.query('SELECT * FROM departments');
    console.log('=== DEPARTMENTS TABLE ===');
    console.table(depts.rows);

    const ttDepts = await pool.query('SELECT DISTINCT department, department_id, semester FROM timetable');
    console.log('=== TIMETABLE DEPTS ===');
    console.table(ttDepts.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkDepts();
