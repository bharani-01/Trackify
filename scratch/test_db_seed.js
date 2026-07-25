const db = require('../backend/src/config/db');

async function checkSeedValues() {
  console.log('--- VERIFYING SYSTEM SETTINGS SEED VALUES ---');
  try {
    const res = await db.query("SELECT * FROM system_settings WHERE key LIKE 'mail_from_%'");
    console.log(`Found settings count: ${res.rows.length}`);
    for (const row of res.rows) {
      console.log(`Key: ${row.key} | Value: ${row.value}`);
    }
  } catch (error) {
    console.error('Database diagnostics failed:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Small timeout to allow db initialization to finish
setTimeout(checkSeedValues, 2000);
