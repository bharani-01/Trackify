const db = require('../backend/src/config/db');

async function run() {
  try {
    const cols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attendance'");
    console.table(cols.rows);

    const u = await db.query("SELECT id FROM users WHERE register_number = 'E0224035'");
    const uid = u.rows[0].id;
    const logs = await db.query(`
      SELECT a.date, a.status, s.subject_code, s.subject_name
      FROM attendance a
      JOIN subjects s ON a.subject_id = s.id
      WHERE a.user_id = $1 
        AND a.date >= '2026-07-13' AND a.date <= '2026-08-30'
        AND s.subject_code IN ('CYB23CT301', 'CYB23DEU02', 'CYB23CL302')
      ORDER BY s.subject_code, a.date
    `, [uid]);
    
    console.log('--- Absents in Trackify (2026-07-13 to 2026-08-30) ---');
    console.table(logs.rows.filter(r => r.status === 'Absent'));
    
    console.log('\n--- All logs for CYB23CL302 (ML Cloud Lab) ---');
    console.table(logs.rows.filter(r => r.subject_code === 'CYB23CL302'));
  } finally {
    await db.pool.end();
  }
}

run();
