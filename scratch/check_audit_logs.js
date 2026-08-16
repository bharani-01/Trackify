const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase') || connectionString.includes('pooler') ? { rejectUnauthorized: false } : false
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT id, user_id, action, details, created_at 
      FROM audit_logs 
      WHERE created_at >= '2026-08-15 13:30:00' AND created_at <= '2026-08-15 14:00:00'
      ORDER BY created_at ASC
    `);
    console.log('--- AUDIT LOGS AROUND DUP CREATION TIME ---');
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
