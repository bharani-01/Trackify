const db = require('../backend/src/config/db');
const { runDailyRemindersSweep, runLowAttendanceSweep, runSummaryEmailsSweep } = require('../backend/src/services/reminderScheduler');

async function testWithEnabled() {
  try {
    console.log('=== TESTING SWEEP PREVIEWS WITH GLOBAL EMAIL ENABLED ===\n');

    // Temporarily test with global_email_notifications enabled
    await db.query("UPDATE system_settings SET value = 'true' WHERE key = 'global_email_notifications'");

    // 1. Low Attendance Warnings Preview
    const lowPreviews = await runLowAttendanceSweep(true);
    console.log(`Low Attendance Previews Count: ${lowPreviews.length}`);
    console.table(lowPreviews.map(p => ({
      name: p.name,
      email: p.email,
      subject: p.subject
    })));

    // 2. Summary Previews (Last 15 days)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const summaryPreviews = await runSummaryEmailsSweep(startDate, endDate, true, null);
    console.log(`\nSummary Previews Count (${startDate} to ${endDate}): ${summaryPreviews.length}`);
    console.table(summaryPreviews.slice(0, 5).map(p => ({
      name: p.name,
      email: p.email,
      subject: p.subject
    })));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

testWithEnabled();
