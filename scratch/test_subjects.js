const db = require('../backend/src/config/db');
const adminRepository = require('../backend/src/repositories/adminRepository');

async function test() {
  const testCases = [
    { dept: 'CSE', sem: 1 },
    { dept: '550e8400-e29b-41d4-a716-446655440000', sem: 1 },
    { dept: 'Computer Science & Engineering', sem: 1 },
    { dept: 'CSE & IT', sem: 2 },
    { dept: 'undefined', sem: 1 },
    { dept: 'null', sem: 1 }
  ];

  for (const tc of testCases) {
    try {
      console.log(`Testing dept: "${tc.dept}", sem: ${tc.sem}`);
      const res = await adminRepository.getMasterSubjects(tc.dept, tc.sem);
      console.log(`  Success! Found ${res.length} rows`);
    } catch (err) {
      console.error(`  ERROR for dept: "${tc.dept}", sem: ${tc.sem}:`, err.message);
    }
  }

  // Also test departments query
  try {
    console.log('\nFetching departments table content...');
    const depts = await db.query('SELECT * FROM departments');
    console.log('Departments:', depts.rows);

    console.log('\nFetching subjects table content...');
    const subs = await db.query('SELECT id, code, subject_code, name, subject_name, department, department_id, semester FROM subjects LIMIT 10');
    console.log('Subjects sample:', subs.rows);
  } catch (err) {
    console.error('Error fetching tables:', err.message);
  } finally {
    process.exit(0);
  }
}

test();
