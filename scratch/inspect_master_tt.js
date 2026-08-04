const db = require('../backend/src/config/db');

async function inspectMasterTT() {
  try {
    const slots = await db.query('SELECT * FROM timetable WHERE department_id IS NOT NULL LIMIT 15');
    console.log('Master timetable rows:');
    console.log(slots.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

inspectMasterTT();
