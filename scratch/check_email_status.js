const db = require('../backend/src/config/db');

async function main() {
  try {
    console.log('--- SYSTEM SETTINGS ---');
    const settings = await db.query("SELECT * FROM system_settings WHERE key LIKE 'mail%'");
    console.log(settings.rows);

    console.log('\n--- RECENT EMAIL QUEUE ENTRIES ---');
    const queue = await db.query("SELECT id, recipient_email, subject, category, status, error_message, created_at, updated_at FROM email_queue ORDER BY created_at DESC LIMIT 10");
    console.log(queue.rows);

    console.log('\n--- RECENT INBOUND EMAILS (IF ANY) ---');
    const inbound = await db.query("SELECT id, from_email, to_email, subject, created_at FROM inbound_emails ORDER BY created_at DESC LIMIT 5").catch(e => ({ rows: e.message }));
    console.log(inbound.rows);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
