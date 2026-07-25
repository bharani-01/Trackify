const { runLowAttendanceSweep } = require('../backend/src/services/reminderScheduler');

async function testSubjectWiseEmail() {
  console.log('--- VERIFYING SUBJECT-WISE EMAIL GENERATION (PREVIEW MODE) ---');
  try {
    const previews = await runLowAttendanceSweep(true);
    console.log(`Previews generated: ${previews.length}`);
    
    if (previews.length > 0) {
      const firstPreview = previews[0];
      console.log(`\nRecipient: ${firstPreview.name} <${firstPreview.email}>`);
      console.log(`Subject: ${firstPreview.subject}`);
      console.log('--- EMAIL HTML BODY CONTENT ---');
      console.log(firstPreview.html);
      console.log('-------------------------------');
      
      // Perform checks
      const hasSubjectTable = firstPreview.html.includes('Subject-wise Attendance Details');
      const hasForecast = firstPreview.html.includes('classesNeeded') || firstPreview.html.includes('classes to get') || firstPreview.html.includes('Overall Attendance');
      
      console.log(`Check 1: Contains Subject Table -> ${hasSubjectTable ? 'PASS' : 'FAIL'}`);
      console.log(`Check 2: Excludes Forecast Prediction Sentence -> ${!hasForecast ? 'PASS' : 'FAIL'}`);
    } else {
      console.log('No students qualify for low attendance alerts in the database.');
    }
  } catch (err) {
    console.error('Test execution failed:', err.stack);
  }
}

testSubjectWiseEmail();
