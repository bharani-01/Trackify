const db = require('../backend/src/config/db');

async function inspectAjay() {
  const client = await db.pool.connect();
  try {
    const user = await client.query("SELECT * FROM users WHERE email = 'v.ajayathithan@gmail.com'");
    console.log('Ajay User record:');
    console.table(user.rows);

    const ajayId = user.rows[0].id;
    const ajayDept = user.rows[0].department;
    const ajayDeptId = user.rows[0].department_id;
    const ajaySem = user.rows[0].semester;

    console.log('\nSubjects matching Ajay in subjects table:');
    const subjects = await client.query(`
      SELECT s.id, s.user_id, s.department_id, s.department, s.semester, s.subject_code, s.code, s.subject_name, s.name, s.created_at
      FROM subjects s
      WHERE (s.department_id = $1 OR (s.department_id IS NULL AND s.department = $2) OR s.user_id = $3)
        AND (s.semester = $4 OR s.user_id = $3)
      ORDER BY COALESCE(s.subject_code, s.code), s.user_id NULLS LAST;
    `, [ajayDeptId, ajayDept, ajayId, ajaySem]);
    console.table(subjects.rows);

    console.log('\nHow attendanceRepository.getSubjectStats query executes for Ajay:');
    const getStatsQuery = `
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
        SELECT DISTINCT ON (COALESCE(department_id::text, department), semester, UPPER(COALESCE(subject_code, code)))
               id, department_id, department, semester, subject_code, code, subject_name, name, credits, color, total_periods, user_id, created_at
        FROM subjects
        ORDER BY COALESCE(department_id::text, department), semester, UPPER(COALESCE(subject_code, code)), created_at ASC, id ASC
      ) s ON (s.department_id = u.department_id OR (u.department_id IS NULL AND s.department = u.department) OR s.user_id = u.id)
          AND (s.semester = u.semester OR s.user_id = u.id)
      LEFT JOIN attendance a ON s.id = a.subject_id AND a.user_id = u.id
      WHERE u.id = $1
      GROUP BY s.id, s.subject_code, s.code, s.subject_name, s.name, s.credits, s.color, s.total_periods, s.created_at
      ORDER BY COALESCE(s.subject_name, s.name) ASC
    `;
    const statsResult = await client.query(getStatsQuery, [ajayId]);
    console.table(statsResult.rows.map(r => ({
      subject_id: r.subject_id,
      code: r.subject_code,
      name: r.subject_name,
      present: r.present_count,
      conducted: r.conducted_count
    })));

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

inspectAjay();
