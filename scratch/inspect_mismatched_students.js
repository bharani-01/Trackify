const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function inspectMismatches() {
  try {
    const todayStr = '2026-09-27';
    const mismatchRes = await pool.query(
      `SELECT 
        u.id as user_id,
        u.register_number,
        u.name,
        u.department,
        u.department_id,
        u.semester,
        TO_CHAR(a.date, 'YYYY-MM-DD') as date,
        TO_CHAR(a.date, 'FMDay') as day_of_week,
        s.subject_code,
        s.subject_name,
        a.remarks,
        a.status
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      JOIN subjects s ON a.subject_id = s.id
      WHERE a.date <= $1
        AND NOT EXISTS (
          SELECT 1 FROM timetable t
          WHERE (t.department = u.department OR t.department_id = u.department_id)
            AND t.semester = u.semester
            AND t.day = TO_CHAR(a.date, 'FMDay')
            AND t.subject_id = a.subject_id
        )
      ORDER BY u.department, u.semester, u.register_number, a.date, a.remarks`,
      [todayStr]
    );

    console.log(`Total misaligned records: ${mismatchRes.rows.length}`);

    // Group by user and date
    const byUserAndDate = {};
    mismatchRes.rows.forEach(r => {
      const userKey = `${r.register_number} (${r.name}) - Dept: ${r.department}`;
      if (!byUserAndDate[userKey]) byUserAndDate[userKey] = { userId: r.user_id, dept: r.department, deptId: r.department_id, sem: r.semester, dates: {} };
      const dateKey = `${r.date} (${r.day_of_week})`;
      if (!byUserAndDate[userKey].dates[dateKey]) byUserAndDate[userKey].dates[dateKey] = [];
      byUserAndDate[userKey].dates[dateKey].push({
        remarks: r.remarks,
        code: r.subject_code,
        name: r.subject_name,
        status: r.status
      });
    });

    Object.keys(byUserAndDate).forEach(uk => {
      console.log(`\n======================================================`);
      console.log(`STUDENT: ${uk}`);
      console.log(`======================================================`);
      const userObj = byUserAndDate[uk];
      Object.keys(userObj.dates).forEach(dk => {
        console.log(`\n  Date: ${dk} (${userObj.dates[dk].length} misaligned records):`);
        userObj.dates[dk].forEach(rec => {
          console.log(`     - [${rec.remarks}] ${rec.code}: ${rec.name} (${rec.status})`);
        });
      });
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspectMismatches();
