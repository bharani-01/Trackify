const db = require('../backend/src/config/db');

async function batchSeedE06() {
  try {
    console.log('================================================================');
    console.log('=== BATCH SEED: DEPARTMENT E06 (B.Tech ECE) & TIMETABLE (SEM 5) ===');
    console.log('================================================================\n');

    // 1. Ensure Department E06
    let deptRes = await db.query(
      `INSERT INTO departments (code, name) VALUES ('E06', 'B.Tech (ECE)')
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    const deptId = deptRes.rows[0].id;
    console.log(`[DEPARTMENT E06 ID]: ${deptId}`);

    // 2. Master Subjects Data
    const subjectsData = [
      { code: 'CSE23AE301', name: 'Professional Competency Development - V', credits: 2, color: '#f59e0b' },
      { code: 'CSE23AE302', name: 'Professional Coding Practice IV', credits: 2, color: '#3b82f6' },
      { code: 'CSE23CT301', name: 'Computer Networks', credits: 3, color: '#f97316' },
      { code: 'CSE23CL301', name: 'Computer Networks Laboratory', credits: 2, color: '#10b981' },
      { code: 'CLUB_ACT', name: 'Club Activity', credits: 1, color: '#84cc16' },
      { code: 'MENTOR_MEET', name: 'Mentor-Mentee Meeting', credits: 1, color: '#6b7280' },
      { code: 'ECE24SLU09', name: 'Antenna Design Tools', credits: 2, color: '#8b5cf6' },
      { code: 'ECE24CT301', name: 'Linear Integrated Circuits', credits: 4, color: '#ec4899' },
      { code: 'ECE24CT302', name: 'Analog Communication', credits: 3, color: '#06b6d4' },
      { code: 'ECE24CT303', name: 'Antenna and Wave Propagation', credits: 4, color: '#6366f1' },
      { code: 'ECE24DLU13', name: 'Digital Image Processing Laboratory', credits: 2, color: '#059669' },
      { code: 'ECE24DEU13', name: 'Digital Image Processing', credits: 3, color: '#14b8a6' },
      { code: 'ECE24CL302', name: 'Antenna Laboratory', credits: 2, color: '#a855f7' },
      { code: 'ECE24CL303', name: 'Linear Integrated Circuits Laboratory', credits: 2, color: '#ef4444' },
      { code: 'ECE24CL301', name: 'Analog Communication Laboratory', credits: 2, color: '#10b981' }
    ];

    // Batch insert subjects
    const subValues = [];
    const subParams = [];
    let pIdx = 1;

    for (const sub of subjectsData) {
      subValues.push(`($${pIdx}, $${pIdx}, $${pIdx+1}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, 'E06', 5, $${pIdx+4}, NULL)`);
      subParams.push(sub.code, sub.name, sub.credits, sub.color, deptId);
      pIdx += 5;
    }

    const subQuery = `
      INSERT INTO subjects (subject_code, code, subject_name, name, credits, color, department, semester, department_id, user_id)
      VALUES ${subValues.join(', ')}
      ON CONFLICT DO NOTHING
    `;

    await db.query(subQuery, subParams);
    console.log('✓ [15 MASTER SUBJECTS INSTALLED]');

    // Fetch all master subject IDs for E06
    const subFetch = await db.query(
      `SELECT id, UPPER(COALESCE(subject_code, code)) as code FROM subjects WHERE department_id = $1 AND semester = 5 AND user_id IS NULL`,
      [deptId]
    );

    const subjectIdMap = {};
    subFetch.rows.forEach(r => subjectIdMap[r.code] = r.id);

    // 3. Timetable Grid
    const timeSlots = {
      1: { start: '08:00:00', end: '08:55:00' },
      2: { start: '08:55:00', end: '09:50:00' },
      3: { start: '10:10:00', end: '11:05:00' },
      4: { start: '11:05:00', end: '12:00:00' },
      5: { start: '13:00:00', end: '13:50:00' },
      6: { start: '13:50:00', end: '14:40:00' },
      7: { start: '14:55:00', end: '15:45:00' }
    };

    const timetableGrid = [
      // MONDAY
      { day: 'Monday', period: 1, code: 'CSE23AE301', room: 'CR 4' },
      { day: 'Monday', period: 2, code: 'CSE23AE301', room: 'CR 4' },
      { day: 'Monday', period: 3, code: 'CSE23CL301', room: 'CR 4' },
      { day: 'Monday', period: 4, code: 'CSE23CL301', room: 'CR 4' },
      { day: 'Monday', period: 5, code: 'ECE24SLU09', room: 'CR 4' },
      { day: 'Monday', period: 6, code: 'ECE24CT301', room: 'CR 4' },
      { day: 'Monday', period: 7, code: 'ECE24CT302', room: 'CR 4' },

      // TUESDAY
      { day: 'Tuesday', period: 1, code: 'ECE24DLU13', room: 'ECE Computer Lab' },
      { day: 'Tuesday', period: 2, code: 'ECE24DLU13', room: 'ECE Computer Lab' },
      { day: 'Tuesday', period: 3, code: 'ECE24CT301', room: 'CR 4' },
      { day: 'Tuesday', period: 4, code: 'ECE24CT303', room: 'CR 4' },
      { day: 'Tuesday', period: 5, code: 'ECE24CT303', room: 'CR 4' },
      { day: 'Tuesday', period: 6, code: 'ECE24CT302', room: 'CR 4' },
      { day: 'Tuesday', period: 7, code: 'ECE24CT302', room: 'CR 4' },

      // WEDNESDAY
      { day: 'Wednesday', period: 1, code: 'CSE23AE302', room: 'CR 4' },
      { day: 'Wednesday', period: 2, code: 'CSE23AE302', room: 'CR 4' },
      { day: 'Wednesday', period: 3, code: 'CSE23CT301', room: 'CR 4' },
      { day: 'Wednesday', period: 4, code: 'CLUB_ACT', room: 'CR 4' },
      { day: 'Wednesday', period: 5, code: 'ECE24DEU13', room: 'CR 4' },
      { day: 'Wednesday', period: 6, code: 'CSE23AE301', room: 'CR 4' },
      { day: 'Wednesday', period: 7, code: 'ECE24DEU13', room: 'CR 4' },

      // THURSDAY
      { day: 'Thursday', period: 1, code: 'CSE23CT301', room: 'CR 4' },
      { day: 'Thursday', period: 2, code: 'MENTOR_MEET', room: 'CR 4' },
      { day: 'Thursday', period: 3, code: 'ECE24CL302', room: 'ECE Computer Lab' },
      { day: 'Thursday', period: 4, code: 'ECE24CL302', room: 'ECE Computer Lab' },
      { day: 'Thursday', period: 5, code: 'ECE24CL303', room: 'ECE Instrumentation Lab' },
      { day: 'Thursday', period: 6, code: 'ECE24CL303', room: 'ECE Instrumentation Lab' },
      { day: 'Thursday', period: 7, code: 'ECE24CT301', room: 'CR 4' },

      // FRIDAY
      { day: 'Friday', period: 1, code: 'ECE24DEU13', room: 'CR 4' },
      { day: 'Friday', period: 2, code: 'ECE24CT303', room: 'CR 4' },
      { day: 'Friday', period: 3, code: 'ECE24CL301', room: 'ECE Computer Lab' },
      { day: 'Friday', period: 4, code: 'ECE24CL301', room: 'ECE Computer Lab' },
      { day: 'Friday', period: 5, code: 'CSE23AE302', room: 'CR 4' },
      { day: 'Friday', period: 6, code: 'CSE23AE302', room: 'CR 4' },
      { day: 'Friday', period: 7, code: 'CSE23CT301', room: 'CR 4' },

      // SATURDAY
      { day: 'Saturday', period: 1, code: 'ECE24CT303', room: 'CR 4' },
      { day: 'Saturday', period: 2, code: 'MENTOR_MEET', room: 'CR 4' },
      { day: 'Saturday', period: 3, code: 'ECE24SLU09', room: 'ECE Computer Lab' },
      { day: 'Saturday', period: 4, code: 'ECE24SLU09', room: 'ECE Computer Lab' },
      { day: 'Saturday', period: 5, code: 'ECE24CT301', room: 'CR 4' },
      { day: 'Saturday', period: 6, code: 'ECE24DEU13', room: 'CR 4' },
      { day: 'Saturday', period: 7, code: 'CSE23CT301', room: 'CR 4' }
    ];

    // Delete existing E06 timetable slots
    await db.query(`DELETE FROM timetable WHERE department_id = $1 OR UPPER(department) = 'E06'`, [deptId]);

    // Batch insert timetable
    const ttValues = [];
    const ttParams = [];
    let tIdx = 1;

    for (const slot of timetableGrid) {
      const subId = subjectIdMap[slot.code];
      const times = timeSlots[slot.period];
      if (!subId) throw new Error(`Missing subject ID for code: ${slot.code}`);

      ttValues.push(`($${tIdx}, $${tIdx+1}, $${tIdx+2}, $${tIdx+3}, $${tIdx+4}, $${tIdx+5}, 'E06', 5, $${tIdx+6})`);
      ttParams.push(subId, slot.day, slot.period, times.start, times.end, slot.room, deptId);
      tIdx += 7;
    }

    const ttQuery = `
      INSERT INTO timetable (subject_id, day, period, start_time, end_time, room, department, semester, department_id)
      VALUES ${ttValues.join(', ')}
    `;

    await db.query(ttQuery, ttParams);
    console.log('✓ [42 TIMETABLE SLOTS INSTALLED]');

    console.log('\n================================================================');
    console.log('=== BATCH SEEDING COMPLETED WITH 100% SUCCESS ===');
    console.log('================================================================');

  } catch (err) {
    console.error('Batch Seeding Error:', err);
  } finally {
    process.exit(0);
  }
}

batchSeedE06();
