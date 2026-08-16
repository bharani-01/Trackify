const db = require('../backend/src/config/db');

async function testSweepMatching() {
  try {
    console.log('=== TESTING SWEEP MATCHING FOR ALL STUDENTS ===\n');

    // 1. Check all student users and their department & settings
    const usersRes = await db.query(`
      SELECT u.id, u.name, u.email, u.department, u.department_id, u.semester, 
             s.daily_reminders, s.low_attendance_warnings
      FROM users u
      LEFT JOIN settings s ON u.id = s.user_id
      WHERE u.role = 'student' AND u.is_suspended = FALSE
    `);

    console.log(`Found ${usersRes.rows.length} active students.`);
    console.table(usersRes.rows);

    // 2. Check timetable lookup for today's day (Sunday / Monday etc.)
    const now = new Date();
    const dayNameFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' });
    const todayDayName = dayNameFormatter.format(now);
    const dateStr = now.toISOString().split('T')[0];

    console.log(`\nToday IST Date: ${dateStr} | Day Name: ${todayDayName}`);

    for (const u of usersRes.rows) {
      // Query with strict department_id vs fallback to department string
      const strictRes = await db.query(
        'SELECT period FROM timetable WHERE department_id = $1 AND semester = $2 AND day = $3',
        [u.department_id, u.semester, todayDayName]
      );

      const flexRes = await db.query(`
        SELECT t.period FROM timetable t
        LEFT JOIN departments d ON (t.department_id = d.id OR UPPER(t.department) = UPPER(d.code))
        WHERE (t.department_id = $1 OR UPPER(t.department) = UPPER($2) OR d.id = $1 OR UPPER(d.code) = UPPER($2))
          AND t.semester = $3 AND LOWER(t.day) = LOWER($4)
      `, [u.department_id, u.department, u.semester, todayDayName]);

      console.log(`Student ${u.name} (Dept: ${u.department}, DeptID: ${u.department_id}, Sem: ${u.semester}):`);
      console.log(`  - Strict department_id query returned: ${strictRes.rows.length} slots`);
      console.log(`  - Flexible dept/code query returned: ${flexRes.rows.length} slots`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

testSweepMatching();
