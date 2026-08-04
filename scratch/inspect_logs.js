const db = require('../backend/src/config/db');

async function inspectLogs() {
  try {
    const logs = await db.query(`
      SELECT * FROM audit_logs 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    console.log('Audit Logs count:', logs.rows.length);
    console.log(JSON.stringify(logs.rows, null, 2));
  } catch (err) {
    console.error('Inspect error:', err);
  } finally {
    process.exit(0);
  }
}

inspectLogs();
