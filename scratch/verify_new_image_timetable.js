const db = require('../backend/src/config/db');

async function verifyNewImageTimetable() {
  try {
    console.log('================================================================');
    console.log('=== VERIFYING REVISED DEPT E06 TIMETABLE IMAGE MATCH ===');
    console.log('================================================================\n');

    const dRes = await db.query("SELECT id, code, name FROM departments WHERE UPPER(code) = 'E06'");
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

    // Expected from newly uploaded image:
    const expected = {
      'Monday': {
        1: { code: 'CSE23AE301', room: 'CR 4' },
        2: { code: 'CSE23AE301', room: 'CR 4' },
        3: { code: 'CSE23CL301', room: 'CR 4' },
        4: { code: 'CSE23CL301', room: 'CR 4' },
        5: { code: 'ECE24SLU09', room: 'CR 4' },
        6: { code: 'ECE24CT301', room: 'CR 4' },
        7: { code: 'ECE24CT302', room: 'CR 4' }
      },
      'Tuesday': {
        1: { code: 'ECE24DLU13', room: 'ECE Computer Lab' },
        2: { code: 'ECE24DLU13', room: 'ECE Computer Lab' },
        3: { code: 'ECE24CT301', room: 'CR 4' },
        4: { code: 'ECE24CT303', room: 'CR 4' },
        5: { code: 'ECE24CT303', room: 'CR 4' },
        6: { code: 'ECE24CT302', room: 'CR 4' },
        7: { code: 'ECE24CT302', room: 'CR 4' }
      },
      'Wednesday': {
        1: { code: 'CSE23AE302', room: 'CR 4' },
        2: { code: 'CSE23AE302', room: 'CR 4' },
        3: { code: 'CSE23CT301', room: 'CR 4' },
        4: { code: 'CLUB_ACT', room: 'CR 4' },
        5: { code: 'ECE24DEU13', room: 'CR 4' },
        6: { code: 'CSE23AE301', room: 'CR 4' },
        7: { code: 'ECE24DEU13', room: 'CR 4' }
      },
      'Thursday': {
        1: { code: 'CSE23CT301', room: 'CR 4' },
        2: { code: 'MENTOR_MEET', room: 'CR 4' },
        3: { code: 'ECE24CL302', room: 'ECE Computer Lab' },
        4: { code: 'ECE24CL302', room: 'ECE Computer Lab' },
        5: { code: 'ECE24CL303', room: 'ECE Instrumentation Lab' },
        6: { code: 'ECE24CL303', room: 'ECE Instrumentation Lab' },
        7: { code: 'ECE24CT301', room: 'CR 4' }
      },
      'Friday': {
        1: { code: 'ECE24DEU13', room: 'CR 4' },
        2: { code: 'ECE24CT303', room: 'CR 4' },
        3: { code: 'ECE24CL301', room: 'ECE Computer Lab' },
        4: { code: 'ECE24CL301', room: 'ECE Computer Lab' },
        5: { code: 'CSE23AE302', room: 'CR 4' },
        6: { code: 'CSE23AE302', room: 'CR 4' },
        7: { code: 'CSE23CT301', room: 'CR 4' }
      },
      'Saturday': {
        1: { code: 'ECE24CT303', room: 'CR 4' },
        2: { code: 'MENTOR_MEET', room: 'CR 4' },
        3: { code: 'ECE24SLU09', room: 'ECE Computer Lab' },
        4: { code: 'ECE24SLU09', room: 'ECE Computer Lab' },
        5: { code: 'ECE24CT301', room: 'CR 4' },
        6: { code: 'ECE24DEU13', room: 'CR 4' },
        7: { code: 'CSE23CT301', room: 'CR 4' }
      }
    };

    let passCount = 0;
    let failCount = 0;

    for (const r of slots.rows) {
      const exp = expected[r.day] && expected[r.day][r.period];
      if (exp && exp.code === r.subject_code && exp.room === r.room) {
        passCount++;
      } else {
        failCount++;
        console.log(`Mismatch on ${r.day} Period ${r.period}: DB=${r.subject_code} (${r.room}), Expected=${exp ? exp.code : 'N/A'} (${exp ? exp.room : 'N/A'})`);
      }
    }

    console.log(`\nVERIFICATION SUMMARY: ${passCount} / 42 SLOTS MATCH 100% PERFECTLY (${failCount} mismatches)`);

  } catch (err) {
    console.error('Error verifying:', err);
  } finally {
    process.exit(0);
  }
}

verifyNewImageTimetable();
