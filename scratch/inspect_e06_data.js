const db = require('../backend/src/config/db');

async function inspectE06() {
  try {
    const e06Dept = await db.query("SELECT id, code, name FROM departments WHERE UPPER(code) = 'E06'");
    console.log('--- E06 DEPARTMENT ---');
    console.table(e06Dept.rows);

    const dId = e06Dept.rows[0].id;

    // Check subjects in E06
    const subs = await db.query(`
      SELECT id, subject_code, subject_name, created_at
      FROM subjects
      WHERE (department_id = $1 OR UPPER(department) = 'E06') AND semester = 5 AND user_id IS NULL
      ORDER BY subject_code, created_at ASC
    `, [dId]);

    console.log(`\n--- E06 MASTER SUBJECTS (${subs.rows.length} rows) ---`);
    console.table(subs.rows);

    // Check attendance for E06 subjects
    const att = await db.query(`
      SELECT a.id, a.user_id, a.subject_id, a.date, s.subject_code
      FROM attendance a
      JOIN subjects s ON a.subject_id = s.id
      WHERE (s.department_id = $1 OR UPPER(s.department) = 'E06')
    `, [dId]);

    console.log(`\n--- ATTENDANCE LOGS FOR E06 (${att.rows.length} rows) ---`);
    console.table(att.rows);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

inspectE06();
