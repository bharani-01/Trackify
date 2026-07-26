const db = require('../backend/src/config/db');
const bcrypt = require('bcrypt');

async function reset() {
  try {
    const saltRounds = 10;
    const adminHash = await bcrypt.hash('adminpassword', saltRounds);
    const studentHash = await bcrypt.hash('studentpassword', saltRounds);

    console.log('Resetting passwords in database...');
    
    // Update admin password
    const adminRes = await db.query(
      "UPDATE users SET password_hash = $1 WHERE email = 'bharani.cyber@gmail.com' RETURNING email, role",
      [adminHash]
    );
    console.log('Admin update result:', adminRes.rows);

    // Update a student password (e.g. e0224035@sriher.edu.in)
    const studentRes = await db.query(
      "UPDATE users SET password_hash = $1, is_approved = true, is_suspended = false WHERE email = 'e0224035@sriher.edu.in' RETURNING email, role",
      [studentHash]
    );
    console.log('Student update result:', studentRes.rows);

    // Update another student password to test blocking (e.g. v.ajayathithan@gmail.com)
    const student2Res = await db.query(
      "UPDATE users SET password_hash = $1, is_approved = true, is_suspended = false WHERE email = 'v.ajayathithan@gmail.com' RETURNING email, role",
      [studentHash]
    );
    console.log('Student 2 update result:', student2Res.rows);

    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting passwords:', error);
    process.exit(1);
  }
}

reset();
