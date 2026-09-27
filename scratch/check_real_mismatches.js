const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function checkRealMismatches() {
  try {
    const todayStr = '2026-09-27';
    const mismatchRes = await pool.query(
      `SELECT 
        u.register_number,
        u.name,
        u.department,
        u.semester,
        TO_CHAR(a.date, 'YYYY-MM-DD') as date,
        TRIM(TO_CHAR(a.date, 'Day')) as day_name,
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
            AND TRIM(t.day) = TRIM(TO_CHAR(a.date, 'Day'))
            AND t.subject_id = a.subject_id
        )
      ORDER BY u.department, u.semester, u.register_number, a.date, a.remarks`,
      [todayStr]
    );

    console.log(`Real timetable day mismatches: ${mismatchRes.rows.length}`);

    const byUser = {};
    mismatchRes.rows.forEach(r => {
      const k = `${r.register_number} (${r.name}) [${r.department}]`;
      if (!byUser[k]) byUser[k] = {};
      const dKey = `${r.date} (${r.day_name})`;
      if (!byUser[k][dKey]) byUser[k][dKey] = [];
      byUser[k][dKey].push(`[${r.remarks}] ${r.subject_code} (${r.status})`);
    });

    Object.keys(byUser).forEach(k => {
      console.log(`\n${k}:`);
      Object.keys(byUser[k]).forEach(d => {
        console.log(`  Date: ${d} -> ${byUser[k][d].join(', ')}`);
      });
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkRealMismatches();
