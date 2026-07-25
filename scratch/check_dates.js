const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase') || connectionString.includes('pooler') ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    console.log('Querying attendance date ranges...');
    const result = await pool.query(`
      SELECT MIN(date) AS min_date, MAX(date) AS max_date, COUNT(*) AS count
      FROM attendance
    `);
    console.table(result.rows);

    console.log('Sample logs:');
    const samples = await pool.query(`
      SELECT date, COUNT(*) AS count
      FROM attendance
      GROUP BY date
      ORDER BY date DESC
      LIMIT 10
    `);
    console.table(samples.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
