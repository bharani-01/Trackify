const db = require('../backend/src/config/db');

async function main() {
  try {
    console.log('--- Checking current user_preferences records ---');
    const existing = await db.query('SELECT * FROM user_preferences');
    console.log(`Total user_preferences rows: ${existing.rows.length}`);
    console.log('Current rows:', existing.rows);

    console.log('\n--- 1. Updating all existing user_preferences rows to date_colors_enabled = TRUE ---');
    const updateRes = await db.query('UPDATE user_preferences SET date_colors_enabled = TRUE, updated_at = CURRENT_TIMESTAMP');
    console.log(`Rows updated: ${updateRes.rowCount}`);

    console.log('\n--- 2. Ensuring all registered users have a user_preferences row with date_colors_enabled = TRUE ---');
    const insertMissingRes = await db.query(`
      INSERT INTO user_preferences (user_id, date_colors_enabled, updated_at)
      SELECT id, TRUE, CURRENT_TIMESTAMP FROM users
      ON CONFLICT (user_id) DO UPDATE SET date_colors_enabled = TRUE, updated_at = CURRENT_TIMESTAMP
    `);
    console.log(`Rows inserted/upserted for all users: ${insertMissingRes.rowCount}`);

    const finalRes = await db.query('SELECT count(*) FROM user_preferences WHERE date_colors_enabled = TRUE');
    console.log(`Total users with date_colors_enabled = TRUE: ${finalRes.rows[0].count}`);

    process.exit(0);
  } catch (err) {
    console.error('Error running SQL:', err.message);
    process.exit(1);
  }
}

main();
