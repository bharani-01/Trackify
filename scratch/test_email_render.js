const db = require('../backend/src/config/db');
const { send15DayAttendanceSummary } = require('../backend/src/services/reminderScheduler');

async function testRender() {
  try {
    const userRes = await db.query('SELECT id FROM users LIMIT 1');
    if (userRes.rows.length === 0) {
      console.log('No user in DB');
      return;
    }
    const userId = userRes.rows[0].id;
    const html = await send15DayAttendanceSummary(userId, '2026-08-01', '2026-08-04', true);
    console.log('Summary email HTML generated successfully!');
    console.log('Contains SRET check (should be false):', html.includes('SRET, Chennai'));
    console.log('Contains new contact email check (should be true):', html.includes('contact@trackifyapp.co.in'));
    console.log('Contains old contact email check (should be false):', html.includes('contact@bharani-01.xyz'));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

testRender();
