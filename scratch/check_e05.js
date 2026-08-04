const db = require('../backend/src/config/db');

async function checkE05() {
  try {
    const deptId = 'e789d2fa-6dcf-405c-ba92-6f9708505c16';
    const subs = await db.query(`
      SELECT * FROM subjects 
      WHERE department_id = $1 OR UPPER(department) = 'E05'
    `, [deptId]);
    console.log(`Subjects for E05 (${subs.rows.length}):`);
    console.log(subs.rows);

    const slots = await db.query(`
      SELECT * FROM timetable 
      WHERE department_id = $1 OR UPPER(department) = 'E05'
    `, [deptId]);
    console.log(`Timetable slots for E05 (${slots.rows.length}):`);
    console.log(slots.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkE05();
