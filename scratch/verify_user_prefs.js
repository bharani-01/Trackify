const db = require('../backend/src/config/db');

async function main() {
  console.log('Testing db queries...');
  const res = await db.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'user_preferences'");
  console.log('user_preferences table check result:', res.rows);
  process.exit(0);
}

main().catch(err => {
  console.error('Error in main:', err);
  process.exit(1);
});
