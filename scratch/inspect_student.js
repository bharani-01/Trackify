const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const pool = new Pool({
  connectionString,
  ssl: false
});

async function inspectStudentDetailed() {
  try {
    const userRes = await pool.query(
      "SELECT id, register_number, email, name, department, department_id, semester, is_approved, is_suspended, created_at FROM users WHERE register_number = 'E0124054' OR email = 'saividya2007@gmail.com'"
    );
    const user = userRes.rows[0];
    console.log('USER:', user);

    const userId = user.id;

    // 1. Get subjects
    const subjRes = await pool.query(
      `SELECT id, department_id, department, semester, subject_code, subject_name, credits, total_periods
       FROM subjects
       WHERE (department_id = $1 OR UPPER(TRIM(department)) = UPPER(TRIM($2)))
         AND semester = $3
       ORDER BY id`,
      [user.department_id, user.department, user.semester]
    );
    console.log('\n--- SUBJECTS ---');
    subjRes.rows.forEach(s => {
      console.log(`[${s.id}] code: ${s.subject_code}, name: ${s.subject_name}, dept: ${s.department}, sem: ${s.semester}`);
    });

    // 2. Attendance stats for this user
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
    const statsRes = await pool.query(statsQuery, [userId]);
    console.log('\n--- SUBJECT STATS (getSubjectStats) ---');
    statsRes.rows.forEach(st => {
      console.log(`[${st.subject_code}] ${st.subject_name}: Conducted=${st.conducted_count}, Present=${st.present_count}, Absent=${st.absent_count}, OD=${st.od_count}, ML=${st.medical_count}`);
    });

    // 3. Attendance records for ML Models
    const mlLogsRes = await pool.query(
      `SELECT a.id, a.subject_id, COALESCE(s.subject_code, s.code) as code, COALESCE(s.subject_name, s.name) as subject_name,
              TO_CHAR(a.date, 'YYYY-MM-DD') AS date, a.status, a.remarks, a.created_at
       FROM attendance a
       JOIN subjects s ON a.subject_id = s.id
       WHERE a.user_id = $1 AND (s.subject_name ILIKE '%ML Models%' OR s.subject_code ILIKE '%AIM23%')
       ORDER BY a.date ASC, a.created_at ASC`,
      [userId]
    );
    console.log('\n--- ATTENDANCE LOGS FOR ML SUBJECTS ---');
    console.log(`Total logs found for ML subjects: ${mlLogsRes.rows.length}`);
    mlLogsRes.rows.forEach(l => {
      console.log(`- Date: ${l.date} | Subj: [${l.code}] ${l.subject_name} (ID: ${l.subject_id}) | Status: ${l.status} | Remarks: ${l.remarks} | CreatedAt: ${l.created_at}`);
    });

    // 4. Timetable for ML Models
    const ttRes = await pool.query(
      `SELECT t.id, t.day, t.period, t.start_time, t.end_time, t.room, COALESCE(s.subject_name, s.name) as subject_name, COALESCE(s.subject_code, s.code) as subject_code
       FROM timetable t
       JOIN subjects s ON t.subject_id = s.id
       WHERE (t.department_id = $1 OR UPPER(TRIM(t.department)) = UPPER(TRIM($2))) AND t.semester = $3
         AND (s.subject_name ILIKE '%ML Models%' OR s.subject_code ILIKE '%AIM23%')
       ORDER BY t.day, t.period`,
      [user.department_id, user.department, user.semester]
    );
    console.log('\n--- TIMETABLE FOR ML SUBJECTS ---');
    ttRes.rows.forEach(t => {
      console.log(`- ${t.day} Period ${t.period} (${t.start_time} - ${t.end_time}): [${t.subject_code}] ${t.subject_name} | Room: ${t.room}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

inspectStudentDetailed();
