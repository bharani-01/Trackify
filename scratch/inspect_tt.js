const db = require('../backend/src/config/db');

async function inspectTimetable() {
  try {
    const slots = await db.query('SELECT * FROM timetable LIMIT 15');
    console.log('Sample timetable rows:');
    console.log(slots.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

inspectTimetable();
