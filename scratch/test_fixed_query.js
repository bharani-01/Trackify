const db = require('../backend/src/config/db');

async function testFixedQuery() {
  const client = await db.pool.connect();
  try {
    const fixedQuery = `
      SELECT 
        s.id AS subject_id,
        COALESCE(s.subject_code, s.code) AS subject_code,
        COALESCE(s.subject_name, s.name) AS subject_name,
        s.credits,
        s.color,
        s.total_periods,
        COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0)::int AS present_count,
        COALESCE(SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END), 0)::int AS absent_count,
        COALESCE(SUM(CASE WHEN a.status = 'Medical Leave' THEN 1 ELSE 0 END), 0)::int AS medical_count,
        COALESCE(SUM(CASE WHEN a.status = 'Holiday' THEN 1 ELSE 0 END), 0)::int AS holiday_count,
        COALESCE(SUM(CASE WHEN a.status = 'On Duty' THEN 1 ELSE 0 END), 0)::int AS od_count,
        COALESCE(SUM(CASE WHEN a.status IN ('Present', 'Absent', 'On Duty') THEN 1 ELSE 0 END), 0)::int AS conducted_count
      FROM users u
      JOIN (
        SELECT DISTINCT ON (UPPER(COALESCE(s_inner.subject_code, s_inner.code)))
               s_inner.id, s_inner.department_id, s_inner.department, s_inner.semester, 
               s_inner.subject_code, s_inner.code, s_inner.subject_name, s_inner.name, 
               s_inner.credits, s_inner.color, s_inner.total_periods, s_inner.user_id, s_inner.created_at
        FROM subjects s_inner
        WHERE s_inner.user_id IS NULL
        ORDER BY UPPER(COALESCE(s_inner.subject_code, s_inner.code)), s_inner.created_at ASC, s_inner.id ASC
      ) s ON (s.department_id = u.department_id OR (u.department_id IS NULL AND s.department = u.department))
          AND s.semester = u.semester
      LEFT JOIN attendance a ON s.id = a.subject_id AND a.user_id = u.id
      WHERE u.id = $1
      GROUP BY s.id, s.subject_code, s.code, s.subject_name, s.name, s.credits, s.color, s.total_periods, s.created_at
      ORDER BY COALESCE(s.subject_name, s.name) ASC
    `;

    const ajay = await client.query("SELECT id, name FROM users WHERE email = 'v.ajayathithan@gmail.com'");
    const res = await client.query(fixedQuery, [ajay.rows[0].id]);
    
    console.log(`Ajay stats length with fixed query: ${res.rows.length}`);
    console.table(res.rows.map(r => ({
      code: r.subject_code,
      name: r.subject_name,
      present: r.present_count,
      conducted: r.conducted_count
    })));

    const totalConducted = res.rows.reduce((sum, r) => sum + r.conducted_count, 0);
    const dbTotal = await client.query('SELECT COUNT(*) as cnt FROM attendance WHERE user_id = $1', [ajay.rows[0].id]);
    console.log(`Conducted sum: ${totalConducted}, DB Attendance count: ${dbTotal.rows[0].cnt}`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

testFixedQuery();
