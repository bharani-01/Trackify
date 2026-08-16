const db = require('../backend/src/config/db');

async function inspectFriday() {
  try {
    console.log('=== INSPECTING E02 TIMETABLE & COMPUTER NETWORKS FRIDAY SLOTS ===\n');

    // 1. Get E02 Department ID
    const deptRes = await db.query("SELECT id, code, name FROM departments WHERE UPPER(code) = 'E02' OR id::text = 'E02'");
    console.log('E02 Department:', deptRes.rows);

    const e02DeptId = deptRes.rows[0]?.id;

    // 2. Get master subjects for E02
    const subRes = await db.query(`
      SELECT id, subject_code, code, subject_name, name, department_id, department, semester, created_at
      FROM subjects
      WHERE (department_id = $1 OR UPPER(department) = 'E02') AND semester = 5 AND user_id IS NULL
      ORDER BY subject_code ASC
    `, [e02DeptId]);

    console.log('\nMaster Subjects for E02 Sem 5:');
    console.table(subRes.rows.map(s => ({
      id: s.id,
      code: s.subject_code || s.code,
      name: s.subject_name || s.name,
      created_at: s.created_at
    })));

    const cnSubject = subRes.rows.find(s => (s.subject_code === 'CSE23CT301' || s.code === 'CSE23CT301'));
    console.log('\nCanonical E02 Computer Networks Subject ID:', cnSubject ? cnSubject.id : 'NOT FOUND');

    // 3. Inspect Timetable for E02 on Friday (check both day_of_week = 'Friday', 5, '5')
    const ttRes = await db.query(`
      SELECT t.id, t.department_id, t.semester, t.day_of_week, t.period_number, t.start_time, t.end_time, t.subject_id,
             s.subject_code, s.subject_name, s.user_id as sub_user_id
      FROM timetable t
      LEFT JOIN subjects s ON t.subject_id = s.id
      WHERE (t.department_id = $1 OR UPPER(t.department) = 'E02') AND t.semester = 5
      ORDER BY 
        CASE 
          WHEN LOWER(t.day_of_week) = 'monday' THEN 1
          WHEN LOWER(t.day_of_week) = 'tuesday' THEN 2
          WHEN LOWER(t.day_of_week) = 'wednesday' THEN 3
          WHEN LOWER(t.day_of_week) = 'thursday' THEN 4
          WHEN LOWER(t.day_of_week) = 'friday' THEN 5
          WHEN LOWER(t.day_of_week) = 'saturday' THEN 6
          ELSE 7
        END, t.period_number ASC
    `, [e02DeptId]);

    console.log('\nTimetable slots count for E02:', ttRes.rows.length);

    console.log('\n--- ALL FRIDAY TIMETABLE SLOTS FOR E02 ---');
    const fridaySlots = ttRes.rows.filter(r => String(r.day_of_week).toLowerCase() === 'friday' || String(r.day_of_week) === '5');
    console.table(fridaySlots.map(r => ({
      id: r.id,
      day: r.day_of_week,
      period: r.period_number,
      subject_id: r.subject_id,
      code: r.subject_code,
      name: r.subject_name,
      sub_user_id: r.sub_user_id,
      is_canonical: r.subject_id === cnSubject?.id
    })));

    // 4. Also check all Computer Networks timetable slots across all days
    console.log('\n--- ALL COMPUTER NETWORKS (CSE23CT301) TIMETABLE SLOTS FOR E02 ---');
    const cnSlots = ttRes.rows.filter(r => r.subject_code === 'CSE23CT301');
    console.table(cnSlots.map(r => ({
      id: r.id,
      day: r.day_of_week,
      period: r.period_number,
      subject_id: r.subject_id,
      code: r.subject_code,
      is_canonical: r.subject_id === cnSubject?.id
    })));

    // 5. Check attendance records for Friday for students in E02 for Computer Networks
    const attRes = await db.query(`
      SELECT a.id, a.user_id, a.subject_id, a.date, a.status, a.remarks, s.subject_code
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN subjects s ON a.subject_id = s.id
      WHERE (u.department_id = $1 OR UPPER(u.department) = 'E02') AND u.semester = 5
        AND (s.subject_code = 'CSE23CT301' OR s.code = 'CSE23CT301' OR a.remarks LIKE '%Period%')
      ORDER BY a.date DESC, a.created_at DESC
      LIMIT 20
    `, [e02DeptId]);

    console.log('\nRecent attendance records for E02 (CN or Period remarks):');
    console.table(attRes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

inspectFriday();
