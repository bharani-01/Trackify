const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function run() {
  try {
    const userRes = await pool.query(
      "SELECT id, register_number, email, name, department, semester FROM users WHERE email = 'saividya2007@gmail.com'"
    );
    const user = userRes.rows[0];
    console.log('User:', user);

    const logs = await pool.query(
      `SELECT a.id, TO_CHAR(a.date, 'YYYY-MM-DD') as date, TO_CHAR(a.date, 'Day') as day_name,
              a.subject_id, COALESCE(s.subject_code, s.code) as code, COALESCE(s.subject_name, s.name) as name,
              a.status, a.remarks, a.created_at
       FROM attendance a
       JOIN subjects s ON a.subject_id = s.id
       WHERE a.user_id = $1
       ORDER BY a.date ASC, a.remarks ASC`,
      [user.id]
    );

    console.log(`\n=== ALL ATTENDANCE LOGS FOR ${user.name} (${logs.rows.length} total records) ===`);
    logs.rows.forEach(r => {
      console.log(`${r.date} (${r.day_name.trim()}): [${r.code}] ${r.name} | ${r.remarks || 'No remarks'} | Status: ${r.status} | Logged: ${r.created_at}`);
    });

    // Let's check timetable adjustments for this user or department
    const adj = await pool.query(
      `SELECT * FROM timetable_adjustments WHERE department = $1 AND semester = $2 ORDER BY date ASC`,
      [user.department, user.semester]
    );
    console.log('\n=== TIMETABLE ADJUSTMENTS ===');
    console.log(adj.rows);

    // Let's check all attendance stats query breakdown for this student
    const statsQuery = `
      SELECT 
        s.id AS subject_id,
        COALESCE(s.subject_code, s.code) AS subject_code,
        COALESCE(s.subject_name, s.name) AS subject_name,
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
    const stats = await pool.query(statsQuery, [user.id]);
    console.log('\n=== SUBJECT STATS BREAKDOWN ===');
    stats.rows.forEach(s => {
      console.log(`${s.subject_code} - ${s.subject_name}: Conducted=${s.conducted_count}, Present=${s.present_count}, Absent=${s.absent_count}, OD=${s.od_count}, ML=${s.medical_count}, Holiday=${s.holiday_count}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
