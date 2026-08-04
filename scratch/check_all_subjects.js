const db = require('../backend/src/config/db');

async function checkAllSubjects() {
  try {
    const subs = await db.query('SELECT * FROM subjects');
    console.log(`Total subjects in DB: ${subs.rows.length}`);
    subs.rows.forEach(s => {
      console.log(`ID: ${s.id} | Code: ${s.subject_code || s.code} | Name: ${s.subject_name || s.name} | Dept: ${s.department} | DeptId: ${s.department_id} | Sem: ${s.semester} | User: ${s.user_id}`);
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkAllSubjects();
