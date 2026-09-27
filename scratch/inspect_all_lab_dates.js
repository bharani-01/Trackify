const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function run() {
  try {
    // 1. All distinct dates where ANY student in E01 Sem 5 logged AIM23CL302
    const datesRes = await pool.query(
      `SELECT TO_CHAR(a.date, 'YYYY-MM-DD') as date, TO_CHAR(a.date, 'Dy') as day_name,
              COUNT(DISTINCT a.user_id) as student_count,
              COUNT(a.id) as total_records,
              ARRAY_AGG(DISTINCT a.remarks) as periods
       FROM attendance a
       JOIN subjects s ON a.subject_id = s.id
       JOIN users u ON a.user_id = u.id
       WHERE s.subject_code = 'AIM23CL302' AND u.department = 'E01' AND u.semester = 5
       GROUP BY a.date
       ORDER BY a.date ASC`
    );

    console.log('=== DISTINCT DATES WHERE AIM23CL302 (ML LAB) WAS LOGGED IN E01 SEM 5 ===');
    datesRes.rows.forEach(r => {
      console.log(`Date: ${r.date} (${r.day_name.trim()}): ${r.student_count} student(s) | Records: ${r.total_records} | Periods: ${JSON.stringify(r.periods)}`);
    });

    // 2. Count for each student in cohort
    const studentCounts = await pool.query(
      `SELECT u.register_number, u.name,
              COUNT(a.id) as total_lab_periods,
              COUNT(DISTINCT a.date) as distinct_lab_days
       FROM users u
       LEFT JOIN attendance a ON u.id = a.user_id
       LEFT JOIN subjects s ON a.subject_id = s.id AND s.subject_code = 'AIM23CL302'
       WHERE u.department = 'E01' AND u.semester = 5
       GROUP BY u.id, u.register_number, u.name
       ORDER BY total_lab_periods DESC`
    );

    console.log('\n=== LAB RECORD COUNTS PER STUDENT IN E01 SEM 5 ===');
    studentCounts.rows.forEach(s => {
      console.log(`${s.register_number} | ${s.name}: ${s.total_lab_periods} periods across ${s.distinct_lab_days} days`);
    });

    // 3. Calendar breakdown of all Mondays from July 1, 2026 to Sep 27, 2026
    console.log('\n=== CALENDAR MONDAYS (July 1 to Sep 27, 2026) ===');
    let d = new Date(2026, 6, 1); // July 1, 2026
    const end = new Date(2026, 8, 27); // Sep 27, 2026
    let mondayCount = 0;
    while (d <= end) {
      if (d.getDay() === 1) { // Monday
        mondayCount++;
        const dateStr = d.toISOString().substring(0, 10);
        console.log(`Monday #${mondayCount}: ${dateStr}`);
      }
      d.setDate(d.getDate() + 1);
    }
    console.log(`Total Mondays up to Sep 27, 2026: ${mondayCount} Mondays (= ${mondayCount * 2} periods at 2 periods/week)`);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
