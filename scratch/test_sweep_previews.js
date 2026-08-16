const db = require('../backend/src/config/db');
const { runDailyRemindersSweep, runLowAttendanceSweep, runSummaryEmailsSweep } = require('../backend/src/services/reminderScheduler');

async function testSweepPreviews() {
  try {
    console.log('=== TESTING SWEEP PREVIEWS FOR ADMIN PORTAL ===\n');

    // 1. Daily Reminders Preview
    const dailyPreviews = await runDailyRemindersSweep(null, true);
    console.log(`Daily Reminders Preview Matches: ${dailyPreviews.length}`);

    // 2. Low Attendance Warning Preview
    const lowPreviews = await runLowAttendanceSweep(true);
    console.log(`Low Attendance Previews Matches: ${lowPreviews.length}`);

    // 3. Low Attendance query check (check actual student percentages)
    const lowRes = await db.query(`
      SELECT 
        u.id, u.name, u.email,
        s.minimum_attendance,
        ROUND((SUM(CASE WHEN a.status IN ('Present', 'On Duty') THEN 1 ELSE 0 END)::float / 
          NULLIF(SUM(CASE WHEN a.status IN ('Present', 'Absent', 'On Duty') THEN 1 ELSE 0 END), 0)) * 100) AS percentage
      FROM users u
      JOIN settings s ON u.id = s.user_id
      LEFT JOIN attendance a ON u.id = a.user_id
      WHERE u.role = 'student' AND s.low_attendance_warnings = TRUE AND u.is_suspended = FALSE
      GROUP BY u.id, u.name, u.email, s.minimum_attendance
    `);
    console.log('\nStudent Overall Attendance Percentages:');
    console.table(lowRes.rows.map(r => ({
      name: r.name,
      pct: r.percentage,
      target: r.minimum_attendance || 80,
      isLow: r.percentage !== null && r.percentage < (r.minimum_attendance || 80)
    })));

    // 4. Summary Preview test for last 30 days
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const summaryPreviews = await runSummaryEmailsSweep(startDate, endDate, true, null);
    console.log(`\nSummary Previews Matches (${startDate} to ${endDate}): ${summaryPreviews.length}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

testSweepPreviews();
