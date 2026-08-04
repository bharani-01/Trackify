const adminRepository = require('../backend/src/repositories/adminRepository');

async function verify() {
  try {
    const subjects = await adminRepository.getMasterSubjects('E05', 5);
    console.log(`Master Subjects retrieved: ${subjects.length}`);
    subjects.forEach(s => console.log(` - [${s.subject_code}] ${s.subject_name} (${s.color})`));

    const timetable = await adminRepository.getMasterTimetable('E05', 5);
    console.log(`\nMaster Timetable slots retrieved: ${timetable.length}`);
  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    process.exit(0);
  }
}

verify();
