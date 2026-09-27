const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function auditAll() {
  try {
    const todayStr = new Date().toISOString().substring(0, 10);
    console.log(`=== TRACKIFY COMPREHENSIVE ATTENDANCE AUDIT (Today: ${todayStr}) ===\n`);

    // 1. All active students
    const studentsRes = await pool.query(
      `SELECT u.id, u.register_number, u.name, u.email, u.department, u.department_id, u.semester,
              COUNT(a.id) as total_attendance_rows
       FROM users u
       LEFT JOIN attendance a ON u.id = a.user_id
       WHERE u.role = 'student'
       GROUP BY u.id, u.register_number, u.name, u.email, u.department, u.department_id, u.semester
       ORDER BY u.department, u.semester, u.register_number`
    );

    console.log(`Total Students Registered: ${studentsRes.rows.length}`);
    console.table(studentsRes.rows.map(s => ({
      RegNo: s.register_number,
      Name: s.name,
      Dept: s.department,
      Sem: s.semester,
      TotalLogs: s.total_attendance_rows
    })));

    // 2. Audit: Future attendance records (> today)
    const futureRes = await pool.query(
      `SELECT u.register_number, u.name, u.email, u.department, u.semester,
              TO_CHAR(a.date, 'YYYY-MM-DD') as date, TO_CHAR(a.date, 'Dy') as day,
              s.subject_code, s.subject_name, a.status, a.remarks
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       JOIN subjects s ON a.subject_id = s.id
       WHERE a.date > $1
       ORDER BY a.date, u.register_number, a.remarks`,
      [todayStr]
    );

    console.log(`\n=== 2. FUTURE DATED ATTENDANCE RECORDS (${futureRes.rows.length} records found) ===`);
    if (futureRes.rows.length === 0) {
      console.log('No future attendance records found.');
    } else {
      const futureByStudent = {};
      futureRes.rows.forEach(r => {
        if (!futureByStudent[r.register_number]) {
          futureByStudent[r.register_number] = { name: r.name, count: 0, dates: new Set() };
        }
        futureByStudent[r.register_number].count++;
        futureByStudent[r.register_number].dates.add(r.date);
      });
      console.table(Object.keys(futureByStudent).map(reg => ({
        RegNo: reg,
        Name: futureByStudent[reg].name,
        FutureLogs: futureByStudent[reg].count,
        FutureDates: Array.from(futureByStudent[reg].dates).join(', ')
      })));
    }

    // 3. Audit: Timetable day-of-week mismatches
    // Find attendance records where the subject logged on that day of week is NOT in the timetable for that student's cohort on that day of week!
    const mismatchRes = await pool.query(
      `WITH timetable_days AS (
        SELECT DISTINCT 
          COALESCE(t.department_id::text, t.department) as dept_match,
          t.semester,
          t.day,
          t.subject_id
        FROM timetable t
      )
      SELECT 
        u.register_number,
        u.name,
        u.department,
        u.semester,
        TO_CHAR(a.date, 'YYYY-MM-DD') as date,
        TO_CHAR(a.date, 'FMDay') as day_of_week,
        s.subject_code,
        s.subject_name,
        a.remarks,
        a.status,
        a.created_at
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
      ORDER BY u.department, u.semester, u.register_number, a.date`,
      [todayStr]
    );

    console.log(`\n=== 3. TIMETABLE DAY-OF-WEEK MISMATCHES (${mismatchRes.rows.length} records found) ===`);
    if (mismatchRes.rows.length === 0) {
      console.log('Zero timetable day-of-week mismatches found! All student records align with the timetable.');
    } else {
      const mismatchByStudent = {};
      mismatchRes.rows.forEach(r => {
        const key = `${r.register_number} (${r.name})`;
        if (!mismatchByStudent[key]) mismatchByStudent[key] = [];
        mismatchByStudent[key].push(`[${r.date} (${r.day_of_week})] P:${r.remarks} - ${r.subject_code} (${r.status})`);
      });

      Object.keys(mismatchByStudent).forEach(k => {
        console.log(`\nStudent: ${k} -> ${mismatchByStudent[k].length} misaligned records:`);
        mismatchByStudent[k].forEach(msg => console.log(`   ${msg}`));
      });
    }

    // 4. Audit: Duplicate attendance records (same user, subject, date, remarks)
    const dupRes = await pool.query(
      `SELECT a.user_id, u.register_number, u.name, a.subject_id, s.subject_code, TO_CHAR(a.date, 'YYYY-MM-DD') as date, a.remarks, COUNT(*) as cnt
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       JOIN subjects s ON a.subject_id = s.id
       GROUP BY a.user_id, u.register_number, u.name, a.subject_id, s.subject_code, a.date, a.remarks
       HAVING COUNT(*) > 1`
    );

    console.log(`\n=== 4. DUPLICATE ATTENDANCE RECORDS (${dupRes.rows.length} sets found) ===`);
    if (dupRes.rows.length === 0) {
      console.log('Zero duplicate attendance records found.');
    } else {
      console.table(dupRes.rows);
    }

    // 5. Subject-wise cohort distribution across all subjects
    console.log('\n=== 5. SUBJECT-WISE CONDUCTED COUNTS BY STUDENT ===');
    const allCohortStats = await pool.query(
      `SELECT 
         u.department,
         u.semester,
         COALESCE(s.subject_code, s.code) as code,
         COALESCE(s.subject_name, s.name) as name,
         u.register_number,
         u.name as student_name,
         COUNT(a.id) FILTER (WHERE a.date <= $1) as past_conducted_count,
         COUNT(a.id) FILTER (WHERE a.date > $1) as future_conducted_count,
         COUNT(a.id) as total_conducted
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
       WHERE u.role = 'student'
       GROUP BY u.department, u.semester, s.subject_code, s.code, s.subject_name, s.name, u.register_number, u.name
       ORDER BY u.department, u.semester, s.subject_code, u.register_number`,
      [todayStr]
    );

    // Group by subject and show min/max/average
    const subjMap = {};
    allCohortStats.rows.forEach(r => {
      const key = `[${r.department} Sem ${r.semester}] ${r.code}: ${r.name}`;
      if (!subjMap[key]) subjMap[key] = [];
      subjMap[key].push({
        reg: r.register_number,
        student: r.student_name,
        past: parseInt(r.past_conducted_count, 10),
        future: parseInt(r.future_conducted_count, 10),
        total: parseInt(r.total_conducted, 10)
      });
    });

    Object.keys(subjMap).forEach(k => {
      console.log(`\nSubject: ${k}`);
      const activeStudents = subjMap[k].filter(s => s.total > 0);
      if (activeStudents.length === 0) {
        console.log('   (No attendance marked yet by any student)');
      } else {
        const counts = activeStudents.map(s => s.past);
        const min = Math.min(...counts);
        const max = Math.max(...counts);
        const avg = (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1);
        console.log(`   Active Students: ${activeStudents.length} | Past Conducted Range: ${min} - ${max} (Avg: ${avg})`);
        activeStudents.forEach(s => {
          const futureNote = s.future > 0 ? ` (+${s.future} future)` : '';
          console.log(`     - ${s.reg} (${s.student}): ${s.past} past${futureNote}`);
        });
      }
    });

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await pool.end();
  }
}

auditAll();
