const db = require('../backend/src/config/db');

async function main() {
  try {
    const cols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'inbound_emails'");
    console.log('inbound_emails columns:', cols.rows);

    const rows = await db.query("SELECT * FROM inbound_emails LIMIT 5");
    console.log('inbound_emails rows:', rows.rows);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
