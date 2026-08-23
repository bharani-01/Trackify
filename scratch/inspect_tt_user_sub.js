const db = require('../backend/src/config/db');

async function inspectTtUserSub() {
  const client = await db.pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        t.id as tt_id,
        t.day,
        t.period,
        t.department as tt_dept,
        t.department_id as tt_dept_id,
        t.semester as tt_sem,
        s.id as sub_id,
        s.user_id as sub_user_id,
        u.name as sub_owner_name,
        COALESCE(s.subject_code, s.code) as sub_code,
        COALESCE(s.subject_name, s.name) as sub_name
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.user_id IS NOT NULL
      LIMIT 15;
    `);
    console.log('Sample timetable rows pointing to user-specific subjects:');
    console.table(res.rows);

    const summary = await client.query(`
      SELECT 
        t.department_id IS NULL as dept_id_is_null,
        t.department,
        t.semester,
        COUNT(*) as count
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.id
      WHERE s.user_id IS NOT NULL
      GROUP BY t.department_id IS NULL, t.department, t.semester;
    `);
    console.log('Summary of legacy timetable rows pointing to user-specific subjects:');
    console.table(summary.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

inspectTtUserSub();
