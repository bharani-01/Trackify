const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function simulateRealignment() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // TRANSACTION START

    const userRes = await client.query(
      "SELECT id, register_number, email, name, department, department_id, semester FROM users WHERE email = 'saividya2007@gmail.com'"
    );
    const user = userRes.rows[0];
    const userId = user.id;

    console.log(`Simulating for: ${user.name} (${user.register_number})`);

    // 1. Check current stats before
    const statsQuery = `
      SELECT 
        s.id AS subject_id,
        COALESCE(s.subject_code, s.code) AS subject_code,
        COALESCE(s.subject_name, s.name) AS subject_name,
        COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0)::int AS present_count,
        COALESCE(SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END), 0)::int AS absent_count,
        COALESCE(SUM(CASE WHEN a.status IN ('Present', 'Absent', 'On Duty') THEN 1 ELSE 0 END), 0)::int AS conducted_count
      FROM users u
      JOIN (
        SELECT DISTINCT ON (COALESCE(department_id::text, UPPER(TRIM(department))), semester, UPPER(COALESCE(subject_code, code)))
               id, department_id, department, semester, subject_code, code, subject_name, name, credits, color, total_periods, user_id, created_at
        FROM subjects
        WHERE user_id IS NULL
        ORDER BY COALESCE(department_id::text, UPPER(TRIM(department))), semester, UPPER(COALESCE(subject_code, code)), created_at ASC, id ASC
      ) s ON (s.department_id = u.department_id OR (u.department_id IS NULL AND UPPER(TRIM(s.department)) = UPPER(TRIM(u.department))))
          AND s.semester = u.semester
      LEFT JOIN attendance a ON s.id = a.subject_id AND a.user_id = u.id
      WHERE u.id = $1
      GROUP BY s.id, s.subject_code, s.code, s.subject_name, s.name, s.credits, s.color, s.total_periods, s.created_at
      ORDER BY COALESCE(s.subject_name, s.name) ASC
    `;

    console.log('\n--- BEFORE STATS ---');
    const beforeStats = await client.query(statsQuery, [userId]);
    beforeStats.rows.forEach(s => {
      console.log(`[${s.subject_code}] ${s.subject_name}: Conducted=${s.conducted_count}, Present=${s.present_count}, Absent=${s.absent_count}`);
    });

    // The mislogged dates where Monday's timetable was logged on Tuesday/Wednesday:
    // Tuesdays: 2026-07-14, 2026-07-21, 2026-07-28, 2026-08-04, 2026-08-11, 2026-08-18, 2026-09-22
    // Wednesdays: 2026-07-22, 2026-07-29, 2026-08-12
    const misloggedDates = [
      '2026-07-14', '2026-07-21', '2026-07-28', '2026-08-04', '2026-08-11', '2026-08-18', '2026-09-22',
      '2026-07-22', '2026-07-29', '2026-08-12'
    ];

    // Delete attendance rows for these 10 dates for this user
    for (const d of misloggedDates) {
      const del = await client.query('DELETE FROM attendance WHERE user_id = $1 AND date = $2 RETURNING id', [userId, d]);
      console.log(`Deleted ${del.rowCount} incorrect records on ${d}`);
    }

    // Also delete future date pre-markings after today (2026-09-27)
    const delFuture = await client.query('DELETE FROM attendance WHERE user_id = $1 AND date > $2 RETURNING id', [userId, '2026-09-27']);
    console.log(`Deleted ${delFuture.rowCount} future pre-marked records after 2026-09-27`);

    // Fetch master timetable for Tuesday and Wednesday
    const ttRes = await client.query(
      `SELECT t.*, s.subject_code, s.subject_name
       FROM timetable t
       JOIN subjects s ON t.subject_id = s.id
       WHERE (t.department = $1 OR t.department_id = $2) AND t.semester = $3
       ORDER BY t.period`,
      [user.department, user.department_id, user.semester]
    );

    const tuesdaySlots = ttRes.rows.filter(r => r.day === 'Tuesday');
    const wednesdaySlots = ttRes.rows.filter(r => r.day === 'Wednesday');

    // Re-insert correct timetable slots for each mislogged date
    for (const d of misloggedDates) {
      const dayOfWeek = new Date(d).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      const slots = dayOfWeek === 'Tuesday' ? tuesdaySlots : wednesdaySlots;

      // Check if this date had specific status intention (all were Present, except 2026-07-14 which was marked Absent)
      const status = d === '2026-07-14' ? 'Absent' : 'Present';

      for (const slot of slots) {
        await client.query(
          `INSERT INTO attendance (user_id, subject_id, date, status, remarks)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, slot.subject_id, d, status, `Period ${slot.period}`]
        );
      }
      console.log(`Inserted ${slots.length} correct ${dayOfWeek} slots for ${d} as ${status}`);
    }

    console.log('\n--- AFTER STATS (SIMULATION) ---');
    const afterStats = await client.query(statsQuery, [userId]);
    afterStats.rows.forEach(s => {
      console.log(`[${s.subject_code}] ${s.subject_name}: Conducted=${s.conducted_count}, Present=${s.present_count}, Absent=${s.absent_count}`);
    });

    console.log('\n--- COMPARING WITH HARI KRISHNAN GS (E0124053) ---');
    const hariStats = await client.query(statsQuery, ['5a8d9a44-df9f-4316-b844-482a4cba8ff6']);
    hariStats.rows.forEach(s => {
      console.log(`[${s.subject_code}] ${s.subject_name}: Conducted=${s.conducted_count}, Present=${s.present_count}, Absent=${s.absent_count}`);
    });

  } catch (err) {
    console.error('Simulation error:', err);
  } finally {
    // ALWAYS ROLLBACK THE SIMULATION - DO NOT COMMIT YET
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
}

simulateRealignment();
