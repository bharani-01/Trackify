const db = require('../backend/src/config/db');

async function testWhyOnly7() {
  const client = await db.pool.connect();
  try {
    console.log('=== TESTING SUBQUERY FOR E01 and E03 ===\n');

    // Current query
    const currentSubquery = `
      SELECT DISTINCT ON (UPPER(COALESCE(subject_code, code)))
             id, department_id, department, semester, subject_code, code
      FROM subjects
      WHERE user_id IS NULL
      ORDER BY UPPER(COALESCE(subject_code, code)), created_at ASC, id ASC
    `;
    const resCurrent = await client.query(currentSubquery);
    console.log('Current inner subquery total rows:', resCurrent.rows.length);
    console.log('Department breakdown in current subquery:');
    const deptCounts = {};
    for (const r of resCurrent.rows) {
      const d = r.department || r.department_id;
      deptCounts[d] = (deptCounts[d] || 0) + 1;
    }
    console.log(deptCounts);

    // Correct query: DISTINCT ON (department, semester, subject_code)
    const correctSubquery = `
      SELECT DISTINCT ON (COALESCE(department_id::text, UPPER(TRIM(department))), semester, UPPER(COALESCE(subject_code, code)))
             id, department_id, department, semester, subject_code, code, subject_name, name
      FROM subjects
      WHERE user_id IS NULL
      ORDER BY COALESCE(department_id::text, UPPER(TRIM(department))), semester, UPPER(COALESCE(subject_code, code)), created_at ASC, id ASC
    `;
    const resCorrect = await client.query(correctSubquery);
    console.log('\nCorrect inner subquery total rows:', resCorrect.rows.length);

    // Test with student Aadil (E03)
    const aadil = await client.query("SELECT id, name, department_id, department, semester FROM users WHERE name ILIKE '%Aadil%'");
    const testAadil = await client.query(`
      SELECT 
        s.id AS subject_id,
        COALESCE(s.subject_code, s.code) AS subject_code,
        COALESCE(s.subject_name, s.name) AS subject_name,
        COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0)::int AS present_count,
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
    `, [aadil.rows[0].id]);

    console.log(`\nAadil's subjects returned with corrected query: ${testAadil.rows.length}`);
    console.table(testAadil.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

testWhyOnly7();
