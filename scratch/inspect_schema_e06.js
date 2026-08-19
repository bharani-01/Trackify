const db = require('../backend/src/config/db');

async function inspectDb() {
  try {
    const depts = await db.query('SELECT * FROM departments ORDER BY code');
    console.log('--- DEPARTMENTS ---');
    console.table(depts.rows);

    const subCols = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'subjects'");
    console.log('\n--- SUBJECTS COLS ---');
    console.table(subCols.rows);

    const ttCols = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'timetable'");
    console.log('\n--- TIMETABLE COLS ---');
    console.table(ttCols.rows);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

inspectDb();
