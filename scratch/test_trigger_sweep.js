const { runSummaryEmailsSweep } = require('../backend/src/services/reminderScheduler');
const db = require('../backend/src/config/db');

async function test() {
  try {
    console.log('Triggering actual summary sweep for one student...');
    const studentId = '11d8b1b0-f602-49f8-8373-1cc102adba4c'; // Swaminathan
    const count = await runSummaryEmailsSweep('2026-07-10', '2026-07-24', false, studentId);
    console.log('Sweep trigger queued count:', count);

    const logs = await db.query("SELECT * FROM attendance_summary_logs");
    console.log('Logs Table Rows:');
    console.table(logs.rows);
  } catch (err) {
    console.error('Fatal Trigger Sweep Error:', err);
  } finally {
    await db.pool.end();
  }
}

test();
