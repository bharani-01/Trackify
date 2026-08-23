const db = require('../backend/src/config/db');
const attendanceRepository = require('../backend/src/repositories/attendanceRepository');

async function testStatsFor10Students() {
  const client = await db.pool.connect();
  try {
    const userRes = await client.query(`
      SELECT id, name, email, department, semester, department_id
      FROM users
      WHERE name IN ('Somesh', 'PRAVIN M', 'Kalanidhi', 'Kevin', 'VJ', 'Swaminathan', 'Ligneshwer S', 'Karthick', 'Bharani KR', 'Ajay')
    `);

    for (const u of userRes.rows) {
      const stats = await attendanceRepository.getSubjectStats(u.id);
      const totalLogs = await client.query('SELECT COUNT(*) as cnt FROM attendance WHERE user_id = $1', [u.id]);
      const conductedSum = stats.reduce((sum, s) => sum + s.conducted_count, 0);
      console.log(`Student ${u.name}: DB Attendance Count = ${totalLogs.rows[0].cnt}, Stats Conducted Sum = ${conductedSum}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

testStatsFor10Students();
