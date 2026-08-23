const db = require('../backend/src/config/db');

async function checkDiff() {
  const client = await db.pool.connect();
  try {
    const subquery = `
      SELECT DISTINCT ON (COALESCE(department_id::text, department), semester, UPPER(COALESCE(subject_code, code)))
             id, department_id, department, semester, subject_code, code, subject_name, name, credits, color, total_periods, user_id, created_at
      FROM subjects
      ORDER BY COALESCE(department_id::text, department), semester, UPPER(COALESCE(subject_code, code)), created_at ASC, id ASC
    `;
    const res = await client.query(subquery);
    console.log('Total rows in subquery:', res.rows.length);
    
    // Check which user_id is in these rows:
    const userIds = res.rows.filter(r => r.user_id !== null).map(r => r.user_id);
    console.log('User IDs present in subquery:', userIds);
    
    const userNames = await client.query('SELECT id, name FROM users WHERE id = ANY($1)', [userIds]);
    console.log('User names present in subquery:', userNames.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

checkDiff();
