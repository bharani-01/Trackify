const db = require('../backend/src/config/db');
const attendanceRepository = require('../backend/src/repositories/attendanceRepository');

async function compareStats() {
  const client = await db.pool.connect();
  try {
    const bharani = await client.query("SELECT id, name, department_id, department, semester FROM users WHERE name = 'Bharani KR'");
    const ajay = await client.query("SELECT id, name, department_id, department, semester FROM users WHERE name = 'Ajay'");

    console.log('Bharani:', bharani.rows[0]);
    console.log('Ajay:', ajay.rows[0]);

    const bStats = await attendanceRepository.getSubjectStats(bharani.rows[0].id);
    const aStats = await attendanceRepository.getSubjectStats(ajay.rows[0].id);

    console.log('Bharani stats length:', bStats.length);
    console.log('Ajay stats length:', aStats.length);

    console.log('Bharani subject names in stats:', bStats.map(s => s.subject_code));
    console.log('Ajay subject names in stats:', aStats.map(s => s.subject_code));
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

compareStats();
