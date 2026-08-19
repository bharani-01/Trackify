const db = require('../backend/src/config/db');

async function updateE06PostAug2() {
  const client = await db.pool.connect();
  try {
    console.log('================================================================');
    console.log('=== UPDATING E06 TIMETABLE TO POST-AUG 2 SCHEDULE SPECIFICATION ===');
    console.log('================================================================\n');

    await client.query('BEGIN');

    // 1. Get E06 Department ID
    const dRes = await client.query("SELECT id FROM departments WHERE UPPER(code) = 'E06'");
    if (dRes.rows.length === 0) {
      throw new Error('Department E06 not found');
    }
    const deptId = dRes.rows[0].id;
    console.log(`Department E06 ID: ${deptId}`);

    // 2. Fetch canonical master subject map for E06
    const subRes = await client.query(`
      SELECT DISTINCT ON (UPPER(COALESCE(subject_code, code)))
             id, UPPER(COALESCE(subject_code, code)) as code, subject_name
      FROM subjects
      WHERE (department_id = $1 OR UPPER(department) = 'E06')
        AND semester = 5
        AND user_id IS NULL
      ORDER BY UPPER(COALESCE(subject_code, code)), created_at ASC, id ASC
    `, [deptId]);

    const subjectIdMap = {};
    subRes.rows.forEach(r => subjectIdMap[r.code] = r.id);

    // 3. Define Period Timing Map
    const timeSlots = {
      1: { start: '08:00:00', end: '08:55:00' },
      2: { start: '08:55:00', end: '09:50:00' },
      3: { start: '10:10:00', end: '11:05:00' },
      4: { start: '11:05:00', end: '12:00:00' },
      5: { start: '13:00:00', end: '13:50:00' },
      6: { start: '13:50:00', end: '14:40:00' },
      7: { start: '14:55:00', end: '15:45:00' }
    };

    // 4. Exact Post-Aug 2 Timetable Grid (42 Slots)
    const postAug2Grid = [
      // MONDAY
      { day: 'Monday', period: 1, code: 'ECE24CT303', room: 'CR 4' },
      { day: 'Monday', period: 2, code: 'ECE24CT302', room: 'CR 4' },
      { day: 'Monday', period: 3, code: 'CSE23CL301', room: 'CR 4' },
      { day: 'Monday', period: 4, code: 'CSE23CL301', room: 'CR 4' },
      { day: 'Monday', period: 5, code: 'ECE24SLU09', room: 'CR 4' },
      { day: 'Monday', period: 6, code: 'ECE24CT301', room: 'CR 4' },
      { day: 'Monday', period: 7, code: 'ECE24DEU13', room: 'CR 4' },

      // TUESDAY
      { day: 'Tuesday', period: 1, code: 'ECE24CT301', room: 'CR 4' },
      { day: 'Tuesday', period: 2, code: 'ECE24CT302', room: 'CR 4' },
      { day: 'Tuesday', period: 3, code: 'CSE23AE301', room: 'CR 4' },
      { day: 'Tuesday', period: 4, code: 'ECE24CT303', room: 'CR 4' },
      { day: 'Tuesday', period: 5, code: 'CSE23AE302', room: 'CR 4' },
      { day: 'Tuesday', period: 6, code: 'CSE23AE302', room: 'CR 4' },
      { day: 'Tuesday', period: 7, code: 'ECE24CT302', room: 'CR 4' },

      // WEDNESDAY
      { day: 'Wednesday', period: 1, code: 'CSE23AE301', room: 'CR 4' },
      { day: 'Wednesday', period: 2, code: 'CSE23AE301', room: 'CR 4' },
      { day: 'Wednesday', period: 3, code: 'CSE23CT301', room: 'CR 4' },
      { day: 'Wednesday', period: 4, code: 'CLUB_ACT', room: 'CR 4' },
      { day: 'Wednesday', period: 5, code: 'ECE24DEU13', room: 'CR 4' },
      { day: 'Wednesday', period: 6, code: 'ECE24CT301', room: 'CR 4' },
      { day: 'Wednesday', period: 7, code: 'CSE23AE302', room: 'CR 4' },

      // THURSDAY
      { day: 'Thursday', period: 1, code: 'CSE23CT301', room: 'CR 4' },
      { day: 'Thursday', period: 2, code: 'MENTOR_MEET', room: 'CR 4' },
      { day: 'Thursday', period: 3, code: 'ECE24CL302', room: 'ECE Computer Lab' },
      { day: 'Thursday', period: 4, code: 'ECE24CL302', room: 'ECE Computer Lab' },
      { day: 'Thursday', period: 5, code: 'ECE24CL303', room: 'ECE Instrumentation Lab' },
      { day: 'Thursday', period: 6, code: 'ECE24CL303', room: 'ECE Instrumentation Lab' },
      { day: 'Thursday', period: 7, code: 'CSE23AE302', room: 'CR 4' },

      // FRIDAY
      { day: 'Friday', period: 1, code: 'ECE24DEU13', room: 'CR 4' },
      { day: 'Friday', period: 2, code: 'ECE24CT303', room: 'CR 4' },
      { day: 'Friday', period: 3, code: 'ECE24CL301', room: 'ECE Computer Lab' },
      { day: 'Friday', period: 4, code: 'ECE24CL301', room: 'ECE Computer Lab' },
      { day: 'Friday', period: 5, code: 'ECE24DLU13', room: 'ECE Computer Lab' },
      { day: 'Friday', period: 6, code: 'ECE24DLU13', room: 'ECE Computer Lab' },
      { day: 'Friday', period: 7, code: 'CSE23CT301', room: 'CR 4' },

      // SATURDAY
      { day: 'Saturday', period: 1, code: 'ECE24SLU09', room: 'CR 4' },
      { day: 'Saturday', period: 2, code: 'MENTOR_MEET', room: 'CR 4' },
      { day: 'Saturday', period: 3, code: 'ECE24SLU09', room: 'ECE Computer Lab' },
      { day: 'Saturday', period: 4, code: 'ECE24SLU09', room: 'ECE Computer Lab' },
      { day: 'Saturday', period: 5, code: 'ECE24CT301', room: 'CR 4' },
      { day: 'Saturday', period: 6, code: 'ECE24DEU13', room: 'CR 4' },
      { day: 'Saturday', period: 7, code: 'ECE24CT302', room: 'CR 4' }
    ];

    // Delete existing E06 timetable slots ONLY
    const purgeRes = await client.query(
      `DELETE FROM timetable WHERE department_id = $1 OR UPPER(department) = 'E06'`,
      [deptId]
    );
    console.log(`Purged previous E06 timetable slots: ${purgeRes.rowCount} deleted.`);

    // Batch insert new 42 timetable entries for E06
    const ttValues = [];
    const ttParams = [];
    let tIdx = 1;

    for (const slot of postAug2Grid) {
      const subId = subjectIdMap[slot.code];
      const times = timeSlots[slot.period];
      if (!subId) {
        throw new Error(`Master subject ID not found for code: ${slot.code}`);
      }

      ttValues.push(`($${tIdx}, $${tIdx+1}, $${tIdx+2}, $${tIdx+3}, $${tIdx+4}, $${tIdx+5}, 'E06', 5, $${tIdx+6})`);
      ttParams.push(subId, slot.day, slot.period, times.start, times.end, slot.room, deptId);
      tIdx += 7;
    }

    const ttQuery = `
      INSERT INTO timetable (subject_id, day, period, start_time, end_time, room, department, semester, department_id)
      VALUES ${ttValues.join(', ')}
    `;

    await client.query(ttQuery, ttParams);
    console.log(`✓ Installed 42 post-Aug 2 timetable entries for E06.`);

    await client.query('COMMIT');
    console.log('\n================================================================');
    console.log('=== E06 POST-AUG 2 TIMETABLE UPDATE SUCCESSFUL ===');
    console.log('================================================================');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update Error:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

updateE06PostAug2();
