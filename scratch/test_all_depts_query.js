const db = require('../backend/src/config/db');

async function testAllDepts() {
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
        SELECT DISTINCT ON (COALESCE(department_id::text, UPPER(TRIM(department))), semester, UPPER(COALESCE(subject_code, code)))
               id, department_id, department, semester, subject_code, code, subject_name, name, credits, color, total_periods, user_id, created_at
        FROM subjects
        WHERE user_id IS NULL
        ORDER BY COALESCE(department_id::text, UPPER(TRIM(department))), semester, UPPER(COALESCE(subject_code, code)), created_at ASC, id ASC
      ) s ON (s.department_id = u.department_id OR (u.department_id IS NULL AND UPPER(TRIM(s.department)) = UPPER(TRIM(u.department))))
          AND s.semester = u.semester
      LEFT JOIN attendance a ON s.id = a.subject_id AND a.user_id = u.id
      WHERE u.id = $1
      GROUP BY s.id, s.subject_code, s.code, s.subject_name, s.name, s.credits, s.color, s.total_periods, s.created_at
      ORDER BY COALESCE(s.subject_name, s.name) ASC
    `;

    const students = await client.query(`
      SELECT DISTINCT ON (u.department) u.id, u.name, u.department, u.semester
      FROM users u
      WHERE u.role = 'student'
      ORDER BY u.department, u.name;
    `);

    console.log('Testing 1 sample student from each department:');
    for (const st of students.rows) {
      const stats = await client.query(fixedQuery, [st.id]);
      console.log(`Student ${st.name} [Dept: ${st.department}, Sem: ${st.semester}] -> Total Subjects returned: ${stats.rows.length}`);
    }

    // Also check Ajay specifically:
    const ajay = await client.query("SELECT id, name, department, semester FROM users WHERE email = 'v.ajayathithan@gmail.com'");
    const ajayStats = await client.query(fixedQuery, [ajay.rows[0].id]);
    console.log(`Student Ajay [Dept: ${ajay.rows[0].department}, Sem: ${ajay.rows[0].semester}] -> Total Subjects returned: ${ajayStats.rows.length}`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

testAllDepts();
