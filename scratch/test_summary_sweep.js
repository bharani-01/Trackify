const { runSummaryEmailsSweep } = require('../backend/src/services/reminderScheduler');
const db = require('../backend/src/config/db');

async function test() {
  try {
    console.log('Running test summary sweep preview...');
    const result = await runSummaryEmailsSweep('2026-07-10', '2026-07-24', true);
    console.log('Sweep Previews Result Length:', result.length);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Fatal Sweep Error:', err);
  } finally {
    await db.pool.end();
  }
}

test();
