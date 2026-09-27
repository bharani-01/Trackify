const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function runTest() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // Start transaction

    const userRes = await client.query(
      "SELECT id, register_number, email, name, department, department_id, semester FROM users WHERE email = 'saividya2007@gmail.com'"
    );
    const user = userRes.rows[0];
    const userId = user.id;

    // Fetch timetable for E01 semester 5
    const ttRes = await client.query(
      `SELECT t.*, s.subject_code, s.subject_name
       FROM timetable t
       JOIN subjects s ON t.subject_id = s.id
       WHERE (t.department = $1 OR t.department_id = $2) AND t.semester = $3
       ORDER BY t.period`,
      [user.department, user.department_id, user.semester]
    );

    const mondaySlots = ttRes.rows.filter(r => r.day === 'Monday');
    const tuesdaySlots = ttRes.rows.filter(r => r.day === 'Tuesday');
    const wednesdaySlots = ttRes.rows.filter(r => r.day === 'Wednesday');

    // 1. Specific dates to fix
    // List of dates that had misaligned schedules
    const datesToFix = [
      { date: '2026-07-14', day: 'Tuesday', defaultStatus: 'Absent' },
      { date: '2026-07-20', day: 'Monday', defaultStatus: 'Present' },
      { date: '2026-07-21', day: 'Tuesday', defaultStatus: 'Present' },
      { date: '2026-07-22', day: 'Wednesday', defaultStatus: 'Present' },
      { date: '2026-07-27', day: 'Monday', defaultStatus: 'Present' },
      { date: '2026-07-28', day: 'Tuesday', defaultStatus: 'Present' },
      { date: '2026-07-29', day: 'Wednesday', defaultStatus: 'Present' },
      { date: '2026-08-04', day: 'Tuesday', defaultStatus: 'Present' },
      { date: '2026-08-11', day: 'Tuesday', defaultStatus: 'Present' },
      { date: '2026-08-12', day: 'Wednesday', defaultStatus: 'Present' },
      { date: '2026-08-18', day: 'Tuesday', defaultStatus: 'Present' },
      { date: '2026-09-22', day: 'Tuesday', defaultStatus: 'Present' },
    ];

    for (const item of datesToFix) {
      // Delete existing records for this date
      await client.query('DELETE FROM attendance WHERE user_id = $1 AND date = $2', [userId, item.date]);

      const slots = item.day === 'Monday' ? mondaySlots : (item.day === 'Tuesday' ? tuesdaySlots : wednesdaySlots);

      for (const slot of slots) {
        let status = item.defaultStatus;
        // Special case: on 2026-07-29, period 3 was Absent
        if (item.date === '2026-07-29' && slot.period === 3) {
          status = 'Absent';
        }

        await client.query(
          `INSERT INTO attendance (user_id, subject_id, date, status, remarks)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, slot.subject_id, item.date, status, `Period ${slot.period}`]
        );
      }
    }

    // Also clear future pre-marked attendance after today (2026-09-27)
    await client.query('DELETE FROM attendance WHERE user_id = $1 AND date > $2', [userId, '2026-09-27']);

    // Check stats
    const statsQuery = `
      SELECT 
        s.id AS subject_id,
        COALESCE(s.subject_code, s.code) AS subject_code,
        COALESCE(s.subject_name, s.name) AS subject_name,
        COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0)::int AS present_count,
        COALESCE(SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END), 0)::int AS absent_count,
        COALESCE(SUM(CASE WHEN a.status IN ('Present', 'Absent', 'On Duty') THEN 1 ELSE 0 END), 0)::int AS conducted_count,
        ROUND((COALESCE(SUM(CASE WHEN a.status IN ('Present', 'On Duty') THEN 1 ELSE 0 END), 0)::numeric / 
               NULLIF(COALESCE(SUM(CASE WHEN a.status IN ('Present', 'Absent', 'On Duty') THEN 1 ELSE 0 END), 0), 0)) * 100, 1) AS percentage
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

    const res = await client.query(statsQuery, [userId]);
    console.log('=== SAI VIDYA M SUBJECT STATS AFTER REALIGNMENT ===');
    console.table(res.rows.map(r => ({
      Code: r.subject_code,
      Subject: r.subject_name,
      Conducted: r.conducted_count,
      Present: r.present_count,
      Absent: r.absent_count,
      Percentage: `${r.percentage}%`
    })));

    // Cohort comparison for AIM23CL302 and AIM23CT302
    const cohortRes = await client.query(
      `SELECT u.register_number, u.name,
              COUNT(a.id) FILTER (WHERE s.subject_code = 'AIM23CL302' AND a.date <= '2026-09-27') as ml_lab_count,
              COUNT(a.id) FILTER (WHERE s.subject_code = 'AIM23CT302' AND a.date <= '2026-09-27') as ml_theory_count
       FROM users u
       LEFT JOIN attendance a ON u.id = a.user_id
       LEFT JOIN subjects s ON a.subject_id = s.id
       WHERE u.department = 'E01' AND u.semester = 5
       GROUP BY u.id, u.register_number, u.name
       ORDER BY u.register_number`
    );
    console.log('\n=== COHORT COMPARISON (DATES UP TO TODAY) ===');
    console.table(cohortRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    // ALWAYS ROLLBACK IN TEST
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
}

runTest();
