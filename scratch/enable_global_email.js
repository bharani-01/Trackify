const db = require('../backend/src/config/db');

async function enableGlobalEmail() {
  try {
    console.log('Enabling global email notifications and summary emails in system_settings...');
    
    await db.query("UPDATE system_settings SET value = 'true' WHERE key = 'global_email_notifications'");
    await db.query("UPDATE system_settings SET value = 'true' WHERE key = 'summary_email_enabled'");

    const res = await db.query("SELECT key, value FROM system_settings WHERE key IN ('global_email_notifications', 'summary_email_enabled')");
    console.log('Updated System Settings:');
    console.table(res.rows);
  } catch (err) {
    console.error('Error enabling global email:', err);
  } finally {
    process.exit(0);
  }
}

enableGlobalEmail();
