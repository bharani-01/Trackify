const db = require('../backend/src/config/db');

async function getDeptSubjectsBreakdown() {
  const client = await db.pool.connect();
  try {
    console.log('=== [100% READ-ONLY SELECT QUERY] DEPARTMENT SUBJECT BREAKDOWN ===\n');

    // 1. Department master subjects count summary
    const summaryQuery = `
      SELECT 
        d.code as department_code,
        d.name as department_name,
        s.semester,
        COUNT(DISTINCT UPPER(COALESCE(s.subject_code, s.code))) as master_subjects_count
      FROM departments d
      LEFT JOIN subjects s ON (s.department_id = d.id OR UPPER(s.department) = UPPER(d.code)) AND s.user_id IS NULL
      GROUP BY d.code, d.name, s.semester
      ORDER BY d.code ASC, s.semester ASC;
    `;
    const summaryRes = await client.query(summaryQuery);
    console.log('--- Summary Table ---');
    console.table(summaryRes.rows);

    // 2. Detailed list of subjects per department
    const deptsQuery = `SELECT id, code, name FROM departments ORDER BY code ASC`;
    const depts = await client.query(deptsQuery);

    for (const dept of depts.rows) {
      const subjectsQuery = `
        SELECT DISTINCT ON (UPPER(COALESCE(s.subject_code, s.code)))
          s.id,
          COALESCE(s.subject_code, s.code) as subject_code,
          COALESCE(s.subject_name, s.name) as subject_name,
          s.credits,
          s.total_periods,
          s.semester
        FROM subjects s
        WHERE (s.department_id = $1 OR UPPER(s.department) = UPPER($2))
          AND s.user_id IS NULL
        ORDER BY UPPER(COALESCE(s.subject_code, s.code)), s.created_at ASC;
      `;
      const subRes = await client.query(subjectsQuery, [dept.id, dept.code]);
      console.log(`\n======================================================`);
      console.log(`Department: ${dept.code} - ${dept.name} (Total: ${subRes.rows.length} Subjects)`);
      console.log(`======================================================`);
      console.table(subRes.rows.map(r => ({
        Code: r.subject_code,
        Name: r.subject_name,
        Credits: r.credits,
        Periods: r.total_periods,
        Sem: r.semester
      })));
    }

  } catch (err) {
    console.error('Read Error:', err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

getDeptSubjectsBreakdown();
