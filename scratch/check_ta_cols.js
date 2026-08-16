const db = require('../backend/src/config/db');

async function checkTa() {
  try {
    const cols = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'timetable_adjustments'");
    console.log('timetable_adjustments columns:');
    console.table(cols.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkTa();
