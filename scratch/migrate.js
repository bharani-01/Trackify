const { pool } = require('../backend/src/config/db');

async function main() {
  try {
    console.log('Testing connection & running manual migration...');
    const result = await pool.query(`
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE;
    `);
    console.log('Migration succeeded!', result);
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

main();
