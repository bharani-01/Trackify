const db = require('../backend/src/config/db');
const adminRepository = require('../backend/src/repositories/adminRepository');

async function testAdminMasterSubjects() {
  const client = await db.pool.connect();
  try {
    const depts = await client.query('SELECT code FROM departments');
    for (const d of depts.rows) {
      const subjects = await adminRepository.getMasterSubjects(d.code, 5);
      console.log(`Department ${d.code} Sem 5: getMasterSubjects returned ${subjects.length} subjects`);
      
      const counts = {};
      subjects.forEach(s => {
        const code = s.subject_code;
        counts[code] = (counts[code] || 0) + 1;
      });
      const dups = Object.entries(counts).filter(([_, c]) => c > 1);
      if (dups.length > 0) {
        console.log(`  [DUPLICATES FOUND IN ADMIN VIEW for ${d.code}]:`, dups);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

testAdminMasterSubjects();
