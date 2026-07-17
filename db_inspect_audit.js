const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const pool = new Pool({
  connectionString,
  ssl: false
});

async function inspect() {
  try {
    const query = `
      SELECT id, action, details, ip_address, created_at 
      FROM audit_logs 
      ORDER BY created_at DESC 
      LIMIT 15
    `;
    const res = await pool.query(query);
    console.log('--- RECENT AUDIT LOGS IN DB ---');
    res.rows.forEach(r => {
      console.log(`- Action: ${r.action}`);
      console.log(`  Details: ${r.details}`);
      console.log(`  IP: ${r.ip_address} (${typeof r.ip_address})`);
      console.log(`  Date: ${r.created_at}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspect();
