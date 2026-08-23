const db = require('../backend/src/config/db');

async function checkAttReferences() {
  const client = await db.pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        COUNT(*) as total_attendance,
        COUNT(CASE WHEN s.user_id IS NULL THEN 1 END) as att_on_master_sub,
        COUNT(CASE WHEN s.user_id IS NOT NULL THEN 1 END) as att_on_user_sub,
        COUNT(CASE WHEN s.id IS NULL THEN 1 END) as att_on_null_sub
      FROM attendance a
      LEFT JOIN subjects s ON a.subject_id = s.id;
    `);
    console.log('Attendance references breakdown:', res.rows[0]);

    // Check which users have attendance on user_id IS NOT NULL subjects:
    const userAtt = await client.query(`
      SELECT u.name, u.email, COUNT(*) as logs_on_user_sub
      FROM attendance a
      JOIN subjects s ON a.subject_id = s.id
      JOIN users u ON a.user_id = u.id
      WHERE s.user_id IS NOT NULL
      GROUP BY u.name, u.email;
    `);
    console.log('Users with attendance on legacy user-specific subjects:');
    console.table(userAtt.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

checkAttReferences();
