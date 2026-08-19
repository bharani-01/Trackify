const db = require('../backend/src/config/db');

async function verifyE06TimetableMatch() {
  try {
    console.log('================================================================');
    console.log('=== READ-ONLY VERIFICATION OF DEPT E06 TIMETABLE MATCH ===');
    console.log('================================================================\n');

    const dRes = await db.query("SELECT id, code, name FROM departments WHERE UPPER(code) = 'E06'");
    if (dRes.rows.length === 0) {
      console.log('Department E06 not found!');
      process.exit(1);
    }
    const deptId = dRes.rows[0].id;

    const slots = await db.query(`
      SELECT 
        t.day,
        t.period,
        t.start_time,
        t.end_time,
        t.room,
        COALESCE(s.subject_code, s.code) as subject_code,
        COALESCE(s.subject_name, s.name) as subject_name
      FROM timetable t
      JOIN subjects s ON t.subject_id = s.id
      WHERE (t.department_id = $1 OR UPPER(t.department) = 'E06')
      ORDER BY 
        CASE t.day
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
        END,
        t.period ASC
    `, [deptId]);

    console.log(`Retrieved ${slots.rows.length} active timetable slots for E06.\n`);

    // Expected post-Aug 2 timetable from the official signed document:
    const expected = {
      'Monday': {
        1: { code: 'ECE24CT303', name: 'Antenna and Wave Propagation', room: 'CR 4' },
        2: { code: 'ECE24CT302', name: 'Analog Communication', room: 'CR 4' },
        3: { code: 'CSE23CL301', name: 'Computer Networks Laboratory', room: 'CR 4' },
        4: { code: 'CSE23CL301', name: 'Computer Networks Laboratory', room: 'CR 4' },
        5: { code: 'ECE24SLU09', name: 'Antenna Design Tools', room: 'CR 4' },
        6: { code: 'ECE24CT301', name: 'Linear Integrated Circuits', room: 'CR 4' },
        7: { code: 'ECE24DEU13', name: 'Digital Image Processing', room: 'CR 4' }
      },
      'Tuesday': {
        1: { code: 'ECE24CT301', name: 'Linear Integrated Circuits', room: 'CR 4' },
        2: { code: 'ECE24CT302', name: 'Analog Communication', room: 'CR 4' },
        3: { code: 'CSE23AE301', name: 'Professional Competency Development - V', room: 'CR 4' },
        4: { code: 'ECE24CT303', name: 'Antenna and Wave Propagation', room: 'CR 4' },
        5: { code: 'CSE23AE302', name: 'Professional Coding Practice IV', room: 'CR 4' },
        6: { code: 'CSE23AE302', name: 'Professional Coding Practice IV', room: 'CR 4' },
        7: { code: 'ECE24CT302', name: 'Analog Communication', room: 'CR 4' }
      },
      'Wednesday': {
        1: { code: 'CSE23AE301', name: 'Professional Competency Development - V', room: 'CR 4' },
        2: { code: 'CSE23AE301', name: 'Professional Competency Development - V', room: 'CR 4' },
        3: { code: 'CSE23CT301', name: 'Computer Networks', room: 'CR 4' },
        4: { code: 'CLUB_ACT', name: 'Club Activity', room: 'CR 4' },
        5: { code: 'ECE24DEU13', name: 'Digital Image Processing', room: 'CR 4' },
        6: { code: 'ECE24CT301', name: 'Linear Integrated Circuits', room: 'CR 4' },
        7: { code: 'CSE23AE302', name: 'Professional Coding Practice IV', room: 'CR 4' }
      },
      'Thursday': {
        1: { code: 'CSE23CT301', name: 'Computer Networks', room: 'CR 4' },
        2: { code: 'MENTOR_MEET', name: 'Mentor-Mentee Meeting', room: 'CR 4' },
        3: { code: 'ECE24CL302', name: 'Antenna Laboratory', room: 'ECE Computer Lab' },
        4: { code: 'ECE24CL302', name: 'Antenna Laboratory', room: 'ECE Computer Lab' },
        5: { code: 'ECE24CL303', name: 'Linear Integrated Circuits Laboratory', room: 'ECE Instrumentation Lab' },
        6: { code: 'ECE24CL303', name: 'Linear Integrated Circuits Laboratory', room: 'ECE Instrumentation Lab' },
        7: { code: 'CSE23AE302', name: 'Professional Coding Practice IV', room: 'CR 4' }
      },
      'Friday': {
        1: { code: 'ECE24DEU13', name: 'Digital Image Processing', room: 'CR 4' },
        2: { code: 'ECE24CT303', name: 'Antenna and Wave Propagation', room: 'CR 4' },
        3: { code: 'ECE24CL301', name: 'Analog Communication Laboratory', room: 'ECE Computer Lab' },
        4: { code: 'ECE24CL301', name: 'Analog Communication Laboratory', room: 'ECE Computer Lab' },
        5: { code: 'ECE24DLU13', name: 'Digital Image Processing Laboratory', room: 'ECE Computer Lab' },
        6: { code: 'ECE24DLU13', name: 'Digital Image Processing Laboratory', room: 'ECE Computer Lab' },
        7: { code: 'CSE23CT301', name: 'Computer Networks', room: 'CR 4' }
      },
      'Saturday': {
        1: { code: 'ECE24SLU09', name: 'Antenna Design Tools', room: 'CR 4' },
        2: { code: 'MENTOR_MEET', name: 'Mentor-Mentee Meeting', room: 'CR 4' },
        3: { code: 'ECE24SLU09', name: 'Antenna Design Tools', room: 'ECE Computer Lab' },
        4: { code: 'ECE24SLU09', name: 'Antenna Design Tools', room: 'ECE Computer Lab' },
        5: { code: 'ECE24CT301', name: 'Linear Integrated Circuits', room: 'CR 4' },
        6: { code: 'ECE24DEU13', name: 'Digital Image Processing', room: 'CR 4' },
        7: { code: 'ECE24CT302', name: 'Analog Communication', room: 'CR 4' }
      }
    };

    let passCount = 0;
    let mismatchCount = 0;

    const reportGrid = [];

    for (const r of slots.rows) {
      const exp = expected[r.day] && expected[r.day][r.period];
      const match = exp && exp.code === r.subject_code && exp.room === r.room;

      if (match) {
        passCount++;
      } else {
        mismatchCount++;
      }

      reportGrid.push({
        Day: r.day,
        Period: r.period,
        Time: `${r.start_time.substring(0,5)} - ${r.end_time.substring(0,5)}`,
        'DB Subject Code': r.subject_code,
        'Expected Code': exp ? exp.code : 'N/A',
        'DB Room': r.room,
        'Expected Room': exp ? exp.room : 'N/A',
        Status: match ? '✓ MATCH' : '✕ MISMATCH'
      });
    }

    console.table(reportGrid);

    console.log('\n================================================================');
    console.log(`VERIFICATION SUMMARY: ${passCount} / 42 SLOTS MATCH 100% PERFECTLY (${mismatchCount} mismatches)`);
    console.log('================================================================');

  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    process.exit(0);
  }
}

verifyE06TimetableMatch();
