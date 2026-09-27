const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

async function executeRealignment() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const todayStr = '2026-09-27';

    // 1. Fetch all distinct student-date pairs that have timetable mismatches
    const mismatchRes = await client.query(
      `SELECT DISTINCT
        u.id as user_id,
        u.register_number,
        u.name,
        u.department,
        u.department_id,
        u.semester,
        TO_CHAR(a.date, 'YYYY-MM-DD') as date,
        TRIM(TO_CHAR(a.date, 'Day')) as day_name
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE a.date <= $1
        AND NOT EXISTS (
          SELECT 1 FROM timetable t
          WHERE (t.department = u.department OR t.department_id = u.department_id)
            AND t.semester = u.semester
            AND TRIM(t.day) = TRIM(TO_CHAR(a.date, 'Day'))
            AND t.subject_id = a.subject_id
        )
      ORDER BY u.department, u.semester, u.register_number, date`,
      [todayStr]
    );

    console.log(`Starting realignment for ${mismatchRes.rows.length} student-date instances...`);

    for (const row of mismatchRes.rows) {
      const dayName = row.day_name;

      // Master timetable slots for this cohort on this day
      const ttRes = await client.query(
        `SELECT t.*, s.subject_code, s.subject_name
         FROM timetable t
         JOIN subjects s ON t.subject_id = s.id
         WHERE (t.department = $1 OR t.department_id = $2)
           AND t.semester = $3
           AND TRIM(t.day) = $4
         ORDER BY t.period`,
        [row.department, row.department_id, row.semester, dayName]
      );

      // If Sunday or no classes scheduled on this day, delete corrupted entries
      if (dayName === 'Sunday' || ttRes.rows.length === 0) {
        const del = await client.query(
          'DELETE FROM attendance WHERE user_id = $1 AND date = $2 RETURNING id',
          [row.user_id, row.date]
        );
        console.log(`- [${row.register_number} - ${row.name}] Removed ${del.rowCount} unscheduled records on ${row.date} (${dayName})`);
        continue;
      }

      // Check original status preference for this date
      const origStatusRes = await client.query(
        'SELECT status FROM attendance WHERE user_id = $1 AND date = $2',
        [row.user_id, row.date]
      );
      const isAbsent = origStatusRes.rows.length > 0 && origStatusRes.rows.every(r => r.status === 'Absent');
      const targetStatus = isAbsent ? 'Absent' : 'Present';

      // Delete mislogged entries for this date
      await client.query(
        'DELETE FROM attendance WHERE user_id = $1 AND date = $2',
        [row.user_id, row.date]
      );

      // Insert correct timetable slots for this day
      for (const slot of ttRes.rows) {
        await client.query(
          `INSERT INTO attendance (user_id, subject_id, date, status, remarks)
           VALUES ($1, $2, $3, $4, $5)`,
          [row.user_id, slot.subject_id, row.date, targetStatus, `Period ${slot.period}`]
        );
      }
      console.log(`+ [${row.register_number} - ${row.name}] Realigned ${row.date} (${dayName}) -> ${ttRes.rows.length} periods as ${targetStatus}`);
    }

    // Verify 0 remaining mismatches
    const postCheck = await client.query(
      `SELECT COUNT(*) as remaining_mismatches
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       WHERE a.date <= $1
         AND NOT EXISTS (
           SELECT 1 FROM timetable t
           WHERE (t.department = u.department OR t.department_id = u.department_id)
             AND t.semester = u.semester
             AND TRIM(t.day) = TRIM(TO_CHAR(a.date, 'Day'))
             AND t.subject_id = a.subject_id
         )`,
      [todayStr]
    );

    console.log(`\nRemaining mismatches in database: ${postCheck.rows[0].remaining_mismatches}`);

    if (parseInt(postCheck.rows[0].remaining_mismatches, 10) === 0) {
      await client.query('COMMIT');
      console.log('ALL REALIGNMENTS COMMITTED SUCCESSFULLY!');
    } else {
      await client.query('ROLLBACK');
      console.log('Realignments rolled back due to remaining mismatches.');
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Realignment failed, transaction rolled back:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

executeRealignment();
