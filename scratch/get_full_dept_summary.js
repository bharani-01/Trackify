const db = require('../backend/src/config/db');

async function getFullDeptSummary() {
  const client = await db.pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        d.code,
        d.name,
        COALESCE(s.semester, 5) as semester,
        COUNT(DISTINCT UPPER(COALESCE(s.subject_code, s.code))) as count,
        array_agg(DISTINCT UPPER(COALESCE(s.subject_code, s.code))) as subject_codes
      FROM departments d
      LEFT JOIN subjects s ON (s.department_id = d.id OR UPPER(s.department) = UPPER(d.code)) AND s.user_id IS NULL
      GROUP BY d.code, d.name, s.semester
      ORDER BY d.code;
    `);

    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

getFullDeptSummary();
