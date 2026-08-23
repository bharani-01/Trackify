const db = require('../backend/src/config/db');

async function main() {
  try {
    const res = await db.query("SELECT id, email_id, from_address, to_address, subject, status, created_at FROM inbound_emails ORDER BY created_at DESC LIMIT 10");
    console.log('Inbound emails table rows count:', res.rows.length);
    console.log(res.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
