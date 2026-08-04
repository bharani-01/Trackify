const db = require('../backend/src/config/db');

async function safeQuery(sql, params, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      return await db.query(sql, params);
    } catch (err) {
      if (err.code === '40P01' || err.message.includes('deadlock') || err.message.includes('lock')) {
        console.log(`Lock contention encountered (${err.message}). Retrying in 1.5s... (Attempt ${i + 1}/${retries})`);
        await new Promise(res => setTimeout(res, 1500));
      } else {
        throw err;
      }
    }
  }
  return await db.query(sql, params);
}

async function seedE05() {
  try {
    const deptCode = 'E05';
    const semester = 5;

    // Get Department ID for E05
    const deptRes = await safeQuery('SELECT id, code, name FROM departments WHERE UPPER(code) = $1', [deptCode]);
    if (deptRes.rows.length === 0) {
      throw new Error('Department E05 not found!');
    }
    const deptId = deptRes.rows[0].id;
    console.log(`Found Department: ${deptRes.rows[0].name} (ID: ${deptId})`);

    // 1. Clear existing master subjects & timetable slots for E05 sem 5
    await safeQuery(`
      DELETE FROM timetable 
      WHERE (department_id = $1 OR UPPER(department) = $2) AND semester = $3
    `, [deptId, deptCode, semester]);

    await safeQuery(`
      DELETE FROM subjects 
      WHERE (department_id = $1 OR UPPER(department) = $2) AND semester = $3 AND user_id IS NULL
    `, [deptId, deptCode, semester]);

    console.log('Cleared old template subjects and timetable slots for E05 Sem 5.');

    // 2. Master subjects list
    const subjectsData = [
      { code: 'CSE23AE302', name: 'Professional Coding Practice IV', credits: 3, color: '#ec4899', periods: 45 },
      { code: 'MED23DEU09', name: 'AI in Medicine', credits: 3, color: '#8b5cf6', periods: 45 },
      { code: 'MED23CT301', name: 'Health Care Data Analytics', credits: 3, color: '#3b82f6', periods: 45 },
      { code: 'CSE23AE301', name: 'Professional Competency Development - V', credits: 3, color: '#f59e0b', periods: 45 },
      { code: 'MED23CT302', name: 'Machine Learning Algorithms', credits: 3, color: '#10b981', periods: 45 },
      { code: 'AIM23SLU04', name: 'Data Analysis with Pandas and Numpy', credits: 3, color: '#06b6d4', periods: 45 },
      { code: 'MED23CT303', name: 'Biomaterials in Tissue Engineering', credits: 3, color: '#6366f1', periods: 45 },
      { code: 'CLUB_ACT', name: 'Club Activity', credits: 0, color: '#64748b', periods: 15 },
      { code: 'MENTOR_MEET', name: 'Mentor-Mentee Meeting', credits: 0, color: '#94a3b8', periods: 15 },
      { code: 'MED23CL302', name: 'Machine Learning Algorithms Laboratory', credits: 2, color: '#059669', periods: 30 },
      { code: 'MED23DLU07', name: 'AI in Medicine Laboratory', credits: 2, color: '#7c3aed', periods: 30 },
      { code: 'MED23CL301', name: 'Health Care Data Analytics Laboratory', credits: 2, color: '#2563eb', periods: 30 }
    ];

    const subjectMap = {}; // Code -> Subject ID

    for (const sub of subjectsData) {
      const insRes = await safeQuery(`
        INSERT INTO subjects (subject_code, code, subject_name, name, credits, color, department, department_id, semester, total_periods)
        VALUES ($1, $1, $2, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [sub.code, sub.name, sub.credits, sub.color, deptCode, deptId, semester, sub.periods]);

      subjectMap[sub.code] = insRes.rows[0].id;
      console.log(`Inserted master subject: ${sub.code} - ${sub.name}`);
    }

    // 3. Timetable period times map
    const periodTimes = {
      1: { start: '08:00:00', end: '08:55:00' },
      2: { start: '08:55:00', end: '09:50:00' },
      3: { start: '10:10:00', end: '11:05:00' },
      4: { start: '11:05:00', end: '12:00:00' },
      5: { start: '13:00:00', end: '13:50:00' },
      6: { start: '13:50:00', end: '14:40:00' },
      7: { start: '14:55:00', end: '15:45:00' }
    };

    // 4. Timetable slots definition according to Sri Ramachandra E05 Sem V Timetable image
    const timetableSchedule = [
      // MONDAY
      { day: 'Monday', period: 1, subCode: 'CSE23AE302', room: 'CR 18' },
      { day: 'Monday', period: 2, subCode: 'CSE23AE302', room: 'CR 18' },
      { day: 'Monday', period: 3, subCode: 'MED23DEU09', room: 'CR 18' },
      { day: 'Monday', period: 4, subCode: 'MED23CT301', room: 'CR 18' },
      { day: 'Monday', period: 5, subCode: 'CSE23AE301', room: 'CR 18' },
      { day: 'Monday', period: 6, subCode: 'CSE23AE301', room: 'CR 18' },
      { day: 'Monday', period: 7, subCode: 'MED23CT302', room: 'CR 18' },

      // TUESDAY
      { day: 'Tuesday', period: 1, subCode: 'AIM23SLU04', room: 'CR 18' },
      { day: 'Tuesday', period: 2, subCode: 'MED23CT303', room: 'CR 18' },
      { day: 'Tuesday', period: 3, subCode: 'MED23CT302', room: 'CR 18' },
      { day: 'Tuesday', period: 4, subCode: 'MED23DEU09', room: 'CR 18' },
      { day: 'Tuesday', period: 5, subCode: 'MED23CT302', room: 'CR 18' },
      { day: 'Tuesday', period: 6, subCode: 'MED23CT301', room: 'CR 18' },
      { day: 'Tuesday', period: 7, subCode: 'MED23CT303', room: 'CR 18' },

      // WEDNESDAY
      { day: 'Wednesday', period: 1, subCode: 'MED23DEU09', room: 'CR 18' },
      { day: 'Wednesday', period: 2, subCode: 'MED23CT303', room: 'CR 18' },
      { day: 'Wednesday', period: 3, subCode: 'MED23CT302', room: 'CR 18' },
      { day: 'Wednesday', period: 4, subCode: 'CLUB_ACT', room: 'CR 18' },
      { day: 'Wednesday', period: 5, subCode: 'CSE23AE301', room: 'CR 18' },
      { day: 'Wednesday', period: 6, subCode: 'MED23CT303', room: 'CR 18' },
      { day: 'Wednesday', period: 7, subCode: 'MED23CT301', room: 'CR 18' },

      // THURSDAY
      { day: 'Thursday', period: 1, subCode: 'MED23CT301', room: 'CR 18' },
      { day: 'Thursday', period: 2, subCode: 'MENTOR_MEET', room: 'CR 18' },
      { day: 'Thursday', period: 3, subCode: 'MED23CL302', room: 'Med Lab' },
      { day: 'Thursday', period: 4, subCode: 'MED23CL302', room: 'Med Lab' },
      { day: 'Thursday', period: 5, subCode: 'CSE23AE302', room: 'CR 18' },
      { day: 'Thursday', period: 6, subCode: 'CSE23AE302', room: 'CR 18' },
      { day: 'Thursday', period: 7, subCode: 'MED23DEU09', room: 'CR 18' },

      // FRIDAY
      { day: 'Friday', period: 1, subCode: 'MED23DLU07', room: 'Med Lab' },
      { day: 'Friday', period: 2, subCode: 'MED23DLU07', room: 'Med Lab' },
      { day: 'Friday', period: 3, subCode: 'MED23DLU07', room: 'Med Lab' },
      { day: 'Friday', period: 4, subCode: 'MED23CT303', room: 'CR 18' },
      { day: 'Friday', period: 5, subCode: 'MED23CL301', room: 'Med Lab' },
      { day: 'Friday', period: 6, subCode: 'MED23CL301', room: 'Med Lab' },
      { day: 'Friday', period: 7, subCode: 'MED23CL301', room: 'Med Lab' },

      // SATURDAY
      { day: 'Saturday', period: 1, subCode: 'MED23DEU09', room: 'CR 18' },
      { day: 'Saturday', period: 2, subCode: 'MENTOR_MEET', room: 'CR 18' },
      { day: 'Saturday', period: 3, subCode: 'MED23CT302', room: 'CR 18' },
      { day: 'Saturday', period: 4, subCode: 'MED23CT303', room: 'CR 18' },
      { day: 'Saturday', period: 5, subCode: 'MED23CT301', room: 'CR 18' },
      { day: 'Saturday', period: 6, subCode: 'AIM23SLU04', room: 'CR 18' },
      { day: 'Saturday', period: 7, subCode: 'AIM23SLU04', room: 'CR 18' }
    ];

    let count = 0;
    for (const slot of timetableSchedule) {
      const subId = subjectMap[slot.subCode];
      if (!subId) {
        throw new Error(`Subject code ${slot.subCode} not found in map!`);
      }
      const times = periodTimes[slot.period];

      await safeQuery(`
        INSERT INTO timetable (department_id, department, semester, day, period, subject_id, start_time, end_time, room)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [deptId, deptCode, semester, slot.day, slot.period, subId, times.start, times.end, slot.room]);

      count++;
    }

    console.log(`Inserted ${count} master timetable slots for E05 Sem 5.`);

    // Also sync any existing students who are in E05 Semester 5
    const studentUsers = await safeQuery(`
      SELECT id, name FROM users 
      WHERE (department_id = $1 OR UPPER(department) = $2) AND semester = $3 AND role = 'student'
    `, [deptId, deptCode, semester]);

    console.log(`Found ${studentUsers.rows.length} existing student(s) in E05 Sem 5 to sync.`);
    const adminRepository = require('../backend/src/repositories/adminRepository');
    for (const stu of studentUsers.rows) {
      console.log(`Syncing student ${stu.name} (${stu.id})...`);
      await adminRepository.initializeStudentSubjectsAndTimetable(stu.id, deptCode, semester);
    }

    console.log('\n=================================================');
    console.log(' SUCCESS: TIMETABLE SEEDED & SYNCED FOR E05 SEM 5');
    console.log('=================================================\n');
  } catch (err) {
    console.error('Error seeding E05 timetable:', err);
  } finally {
    process.exit(0);
  }
}

seedE05();
