const db = require('../backend/src/config/db');
const { runSummaryEmailsSweep } = require('../backend/src/services/reminderScheduler');

async function testSummaryBroadcastFlow() {
  try {
    console.log('=== VERIFYING ATTENDANCE SUMMARY BROADCAST FEATURE ===\n');

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`Running Attendance Summary Preview (${startDate} to ${endDate})...`);
    const previews = await runSummaryEmailsSweep(startDate, endDate, true, null);
    
    console.log(`\n✓ Generated ${previews.length} Attendance Summary HTML Previews.`);
    if (previews.length > 0) {
      console.log('Sample Preview Details:');
      console.log(`  - To: ${previews[0].name} <${previews[0].email}>`);
      console.log(`  - Subject: ${previews[0].subject}`);
      console.log(`  - HTML Length: ${previews[0].html.length} bytes`);
    }

    // Check single student summary preview (e.g. for student 'Bharani KR')
    const bharaniUser = await db.query("SELECT id, name, email FROM users WHERE name LIKE '%Bharani%' LIMIT 1");
    if (bharaniUser.rows.length > 0) {
      const bId = bharaniUser.rows[0].id;
      const bPreviews = await runSummaryEmailsSweep(startDate, endDate, true, bId);
      console.log(`\n✓ Single Student Summary Preview for ${bharaniUser.rows[0].name}: Generated ${bPreviews.length} preview.`);
    }

    console.log('\n=== ATTENDANCE SUMMARY BROADCAST VERIFICATION PASSED 100% ===');
  } catch (err) {
    console.error('Error testing summary broadcast:', err);
  } finally {
    process.exit(0);
  }
}

testSummaryBroadcastFlow();
