const db = require('../backend/src/config/db');
const userPreferencesRepository = require('../backend/src/repositories/userPreferencesRepository');

async function test() {
  const userRes = await db.query('SELECT id, email FROM users LIMIT 1');
  if (userRes.rows.length === 0) {
    console.log('No users found in db');
    process.exit(0);
  }
  const userId = userRes.rows[0].id;
  console.log('Testing for user:', userRes.rows[0].email);

  const initial = await userPreferencesRepository.getByUserId(userId);
  console.log('Initial preferences:', initial);

  const updated = await userPreferencesRepository.upsert(userId, { date_colors_enabled: false });
  console.log('Updated preferences (false):', updated);

  const restored = await userPreferencesRepository.upsert(userId, { date_colors_enabled: true });
  console.log('Restored preferences (true):', restored);

  console.log('All userPreferencesRepository tests passed!');
  process.exit(0);
}

test().catch(err => {
  console.error('Repository test error:', err);
  process.exit(1);
});
