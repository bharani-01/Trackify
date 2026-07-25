const { runDailyRemindersSweep, runLowAttendanceSweep } = require('../backend/src/services/reminderScheduler');

async function verifySweeps() {
  console.log('--- STARTING SCHEDULER SWEEPS TEST ---');
  try {
    console.log('1. Testing runDailyRemindersSweep(null) (Manual on-demand)...');
    const dailyCount = await runDailyRemindersSweep(null);
    console.log(`SUCCESS: Manual daily reminder sweep completed. Queued: ${dailyCount}`);
    
    console.log('2. Testing runDailyRemindersSweep("18:00") (Auto timer matching)...');
    const dailyCountAuto = await runDailyRemindersSweep("18:00");
    console.log(`SUCCESS: Auto daily reminder sweep completed. Queued: ${dailyCountAuto}`);
    
    console.log('3. Testing runLowAttendanceSweep()...');
    const lowCount = await runLowAttendanceSweep();
    console.log(`SUCCESS: Low attendance sweep completed. Queued: ${lowCount}`);
  } catch (err) {
    console.error('Sweep execution test failed:', err.stack);
  }
}

verifySweeps();
