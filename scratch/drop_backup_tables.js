const backupDb = require('../backend/src/config/backupDb');

async function run() {
  try {
    const tables = ['departments', 'users', 'subjects', 'timetable', 'attendance', 'settings', 'system_settings', 'holidays', 'schedule_adjustments'];
    for (const table of tables) {
      await backupDb.query(`DROP TABLE IF EXISTS backup_${table} CASCADE`);
    }
    await backupDb.query('DROP TABLE IF EXISTS backups CASCADE');
    console.log('Remote backup tables dropped successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error dropping remote tables:', error.message);
    process.exit(1);
  }
}

run();
