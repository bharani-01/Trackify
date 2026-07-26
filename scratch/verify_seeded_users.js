const db = require('../backend/src/config/db');

async function run() {
  try {
    const adminRes = await db.query("SELECT email, role, name FROM users WHERE email = 'maint_admin@trackifyapp.co.in'");
    const studentRes = await db.query("SELECT email, role, name FROM users WHERE email = 'maint_student@trackifyapp.co.in'");
    console.log('Seeded Maintenance Admin:', adminRes.rows);
    console.log('Seeded Maintenance Student:', studentRes.rows);
    process.exit(0);
  } catch (error) {
    console.error('Error verifying seeded users:', error);
    process.exit(1);
  }
}

run();
