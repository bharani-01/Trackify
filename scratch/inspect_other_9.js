const db = require('../backend/src/config/db');

async function inspectOther9() {
  const client = await db.pool.connect();
  try {
    const res = await client.query(`
      SELECT s.user_id, u.name, s.department_id, s.department, s.semester, COUNT(*)
      FROM subjects s
      JOIN users u ON s.user_id = u.id
      GROUP BY s.user_id, u.name, s.department_id, s.department, s.semester;
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

inspectOther9();
