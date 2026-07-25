const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase') || connectionString.includes('pooler') ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    console.log('Connecting to database...');
    const users = await pool.query("SELECT id, name, email, role, is_suspended, is_approved FROM users");
    console.log('--- ALL USERS ---');
    console.table(users.rows);

    const logs = await pool.query("SELECT COUNT(*) FROM attendance");
    console.log(`Total attendance rows: ${logs.rows[0].count}`);

    const summaryLogs = await pool.query("SELECT COUNT(*) FROM attendance_summary_logs");
    console.log(`Total summary logs: ${summaryLogs.rows[0].count}`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
