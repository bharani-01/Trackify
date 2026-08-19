const db = require('../backend/src/config/db');

async function verifyE06() {
  try {
    const depts = await db.query("SELECT * FROM departments WHERE UPPER(code) = 'E06'");
    console.log('--- DEPARTMENT E06 ---');
    console.table(depts.rows);

    const subs = await db.query("SELECT id, subject_code, subject_name, credits FROM subjects WHERE department = 'E06' AND semester = 5 AND user_id IS NULL ORDER BY subject_code");
    console.log(`\n--- MASTER SUBJECTS (Count: ${subs.rows.length}) ---`);
    console.table(subs.rows);

    const tt = await db.query("SELECT t.id, t.day, t.period, s.subject_code, t.room FROM timetable t JOIN subjects s ON t.subject_id = s.id WHERE t.department = 'E06' AND t.semester = 5 ORDER BY t.day, t.period");
    console.log(`\n--- TIMETABLE SLOTS (Count: ${tt.rows.length}) ---`);
    console.table(tt.rows);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

verifyE06();
