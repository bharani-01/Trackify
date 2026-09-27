const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function applyRealignment() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      "SELECT id, register_number, email, name, department, department_id, semester FROM users WHERE email = 'saividya2007@gmail.com'"
    );
    const user = userRes.rows[0];
    const userId = user.id;

    console.log(`Applying realignment for: ${user.name} (${user.register_number})`);

    // Fetch timetable for E01 semester 5
    const ttRes = await client.query(
      `SELECT t.*, s.subject_code, s.subject_name
       FROM timetable t
       JOIN subjects s ON t.subject_id = s.id
       WHERE (t.department = $1 OR t.department_id = $2) AND t.semester = $3
       ORDER BY t.period`,
      [user.department, user.department_id, user.semester]
    );

    const mondaySlots = ttRes.rows.filter(r => r.day === 'Monday');
    const tuesdaySlots = ttRes.rows.filter(r => r.day === 'Tuesday');
    const wednesdaySlots = ttRes.rows.filter(r => r.day === 'Wednesday');

    const datesToFix = [
      { date: '2026-07-14', day: 'Tuesday', defaultStatus: 'Absent' },
      { date: '2026-07-20', day: 'Monday', defaultStatus: 'Present' },
      { date: '2026-07-21', day: 'Tuesday', defaultStatus: 'Present' },
      { date: '2026-07-22', day: 'Wednesday', defaultStatus: 'Present' },
      { date: '2026-07-27', day: 'Monday', defaultStatus: 'Present' },
      { date: '2026-07-28', day: 'Tuesday', defaultStatus: 'Present' },
      { date: '2026-07-29', day: 'Wednesday', defaultStatus: 'Present' },
      { date: '2026-08-04', day: 'Tuesday', defaultStatus: 'Present' },
      { date: '2026-08-11', day: 'Tuesday', defaultStatus: 'Present' },
      { date: '2026-08-12', day: 'Wednesday', defaultStatus: 'Present' },
      { date: '2026-08-18', day: 'Tuesday', defaultStatus: 'Present' },
      { date: '2026-09-22', day: 'Tuesday', defaultStatus: 'Present' },
    ];

    for (const item of datesToFix) {
      await client.query('DELETE FROM attendance WHERE user_id = $1 AND date = $2', [userId, item.date]);

      const slots = item.day === 'Monday' ? mondaySlots : (item.day === 'Tuesday' ? tuesdaySlots : wednesdaySlots);

      for (const slot of slots) {
        let status = item.defaultStatus;
        if (item.date === '2026-07-29' && slot.period === 3) {
          status = 'Absent';
        }

        await client.query(
          `INSERT INTO attendance (user_id, subject_id, date, status, remarks)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, slot.subject_id, item.date, status, `Period ${slot.period}`]
        );
      }
      console.log(`Realigned ${item.date} (${item.day}) -> ${slots.length} periods`);
    }

    // Clear future pre-marked records after today (2026-09-27)
    const futureDel = await client.query('DELETE FROM attendance WHERE user_id = $1 AND date > $2 RETURNING id', [userId, '2026-09-27']);
    console.log(`Cleared ${futureDel.rowCount} pre-marked future records after 2026-09-27`);

    await client.query('COMMIT');
    console.log('\nTRANSACTION COMMITTED SUCCESSFULLY!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Realignment failed, transaction rolled back:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

applyRealignment();
