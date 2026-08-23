const db = require('../backend/src/config/db');
const subjectRepository = require('../backend/src/repositories/subjectRepository');
const timetableRepository = require('../backend/src/repositories/timetableRepository');

async function testSubjectList() {
  const client = await db.pool.connect();
  try {
    const userRes = await client.query(`SELECT id, name, department, semester FROM users WHERE name = 'Bharani KR'`);
    const user = userRes.rows[0];

    const subjects = await subjectRepository.getAllByUserId(user.id);
    const tt = await timetableRepository.getByUserId(user.id);

    console.log(`Subjects returned for ${user.name}: count = ${subjects.length}`);
    console.log('Subject IDs from getAllByUserId:');
    subjects.forEach(s => console.log(`  - ${s.subject_code}: ${s.id} (user_id sub or master?)`));

    // Check which subject IDs are in timetable:
    const ttSubjectIds = new Set(tt.map(t => t.subject_id));
    console.log(`\nTimetable unique subject IDs count = ${ttSubjectIds.size}`);
    
    let mismatches = 0;
    subjects.forEach(s => {
      if (!ttSubjectIds.has(s.id)) {
        console.log(`  [MISMATCH]: Subject list ID ${s.id} for ${s.subject_code} is NOT in timetable!`);
        mismatches++;
      }
    });

    console.log(`Total Mismatches between Subject List and Timetable: ${mismatches}`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

testSubjectList();
