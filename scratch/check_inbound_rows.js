const db = require('../backend/src/config/db');

async function main() {
  try {
    const rows = await db.query("SELECT id, email_id, from_address, to_address, subject, status, received_at FROM inbound_emails ORDER BY received_at DESC LIMIT 10");
    console.log('inbound_emails rows:', rows.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
