const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function run() {
  try {
    const adj = await pool.query(`SELECT * FROM timetable_adjustments LIMIT 10`);
    console.log(`=== TIMETABLE ADJUSTMENTS SAMPLE ===`);
    console.log(adj.rows);

    const count = await pool.query(`SELECT count(*) FROM timetable_adjustments`);
    console.log(`Total count:`, count.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
