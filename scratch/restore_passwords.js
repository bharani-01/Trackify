const db = require('../backend/src/config/db');

async function restore() {
  try {
    console.log('Restoring original password hashes...');
    
    // Restore admin hash
    await db.query(
      "UPDATE users SET password_hash = $1 WHERE email = 'bharani.cyber@gmail.com'",
      ['$2b$10$lfZ8RZO.xMoA2hNzdMoUtOeJ8pdm2yIcjXC98AvdTuyjQtzeLlOdO']
    );

    // Restore e0224035 student hash
    await db.query(
      "UPDATE users SET password_hash = $1 WHERE email = 'e0224035@sriher.edu.in'",
      ['$2b$10$JI8E0FXAdbFORQSLABnazeklUZ3ooEbniLAb7m/KQG0fzrg0c6CzK']
    );

    // Restore v.ajayathithan student hash
    await db.query(
      "UPDATE users SET password_hash = $1 WHERE email = 'v.ajayathithan@gmail.com'",
      ['$2b$10$FqFv3iOrLQcx31wcXp86H.pcgySZySkSSL6kmemjUSmhkbQwmsgMu']
    );

    console.log('Original password hashes restored successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error restoring passwords:', error);
    process.exit(1);
  }
}

restore();
