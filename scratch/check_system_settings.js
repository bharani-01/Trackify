const db = require('../backend/src/config/db');

async function checkSettings() {
  try {
    const res = await db.query('SELECT key, value FROM system_settings');
    console.log('--- SYSTEM SETTINGS IN DB ---');
    console.table(res.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkSettings();
