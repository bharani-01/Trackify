const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function run() {
  try {
    const userRes = await pool.query(
      "SELECT id, register_number, email, name, department, department_id, semester FROM users WHERE email = 'saividya2007@gmail.com'"
    );
    const user = userRes.rows[0];
    console.log('User:', user);

    // 1. All records for ML Models (Lab + Theory)
    const mlLogs = await pool.query(
      `SELECT a.id, TO_CHAR(a.date, 'YYYY-MM-DD') as date, TO_CHAR(a.date, 'Day') as day_name,
              a.subject_id, COALESCE(s.subject_code, s.code) as code, COALESCE(s.subject_name, s.name) as name,
              a.status, a.remarks, a.created_at
       FROM attendance a
       JOIN subjects s ON a.subject_id = s.id
       WHERE a.user_id = $1 AND (s.subject_name ILIKE '%ML Models%' OR s.subject_code ILIKE '%AIM23%')
       ORDER BY s.subject_code, a.date ASC, a.remarks ASC`,
      [user.id]
    );

    console.log('\n=== ALL ATTENDANCE LOGS FOR AIM23 / ML SUBJECTS ===');
    mlLogs.rows.forEach(r => {
      console.log(`${r.date} (${r.day_name.trim()}): [${r.code}] ${r.name} | ${r.remarks || 'No remarks'} | Status: ${r.status} | CreatedAt: ${r.created_at}`);
    });

    // 2. Full timetable for this student's department/semester
    const tt = await pool.query(
      `SELECT t.id, t.day, t.period, t.start_time, t.end_time, t.room,
              COALESCE(s.subject_code, s.code) as code, COALESCE(s.subject_name, s.name) as name
       FROM timetable t
       JOIN subjects s ON t.subject_id = s.id
       WHERE (t.department_id = $1 OR UPPER(TRIM(t.department)) = UPPER(TRIM($2))) AND t.semester = $3
       ORDER BY 
         CASE t.day 
           WHEN 'Monday' THEN 1 
           WHEN 'Tuesday' THEN 2 
           WHEN 'Wednesday' THEN 3 
           WHEN 'Thursday' THEN 4 
           WHEN 'Friday' THEN 5 
           WHEN 'Saturday' THEN 6 
           ELSE 7 
         END, t.period`,
      [user.department_id, user.department, user.semester]
    );

    console.log('\n=== MASTER TIMETABLE FOR DEPT / SEM ===');
    tt.rows.forEach(r => {
      console.log(`${r.day} P${r.period} (${r.start_time} - ${r.end_time}): [${r.code}] ${r.name} | Room: ${r.room}`);
    });

    // 3. Check what was logged on Sun Sep 27 around 14:10 - 14:20 in audit logs
    const audit = await pool.query(
      `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [user.id]
    );
    console.log('\n=== AUDIT LOGS ===');
    audit.rows.slice(0, 25).forEach(r => {
      console.log(`[${r.created_at}] Action: ${r.action} | Details: ${r.details}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
