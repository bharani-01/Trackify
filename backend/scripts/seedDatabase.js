const db = require('../src/config/db');
const bcrypt = require('bcrypt');

const DEPARTMENTS = [
  { code: 'CSE', name: 'Computer Science & Engineering' },
  { code: 'ECE', name: 'Electronics & Communication Engineering' },
  { code: 'MECH', name: 'Mechanical Engineering' },
  { code: 'EEE', name: 'Electrical & Electronics Engineering' },
  { code: 'IT', name: 'Information Technology' }
];

const SUBJECT_TEMPLATES = {
  CSE: [
    { code: 'CS301', name: 'Data Structures & Algorithms', credits: 4 },
    { code: 'CS302', name: 'Database Management Systems', credits: 3 },
    { code: 'CS303', name: 'Operating Systems', credits: 3 },
    { code: 'CS304', name: 'Computer Networks', credits: 3 },
    { code: 'CS305', name: 'Web Technology Lab', credits: 2 }
  ],
  ECE: [
    { code: 'EC301', name: 'Digital Signal Processing', credits: 4 },
    { code: 'EC302', name: 'VLSI Design', credits: 3 },
    { code: 'EC303', name: 'Microcontrollers & Embedded Systems', credits: 3 },
    { code: 'EC304', name: 'Signals & Systems', credits: 3 },
    { code: 'EC305', name: 'Communication Engineering Lab', credits: 2 }
  ],
  MECH: [
    { code: 'ME301', name: 'Thermodynamics & Heat Transfer', credits: 4 },
    { code: 'ME302', name: 'Fluid Mechanics & Machinery', credits: 3 },
    { code: 'ME303', name: 'Kinematics of Machinery', credits: 3 },
    { code: 'ME304', name: 'Manufacturing Processes', credits: 3 },
    { code: 'ME305', name: 'CAD/CAM Lab', credits: 2 }
  ],
  EEE: [
    { code: 'EE301', name: 'Electrical Machines II', credits: 4 },
    { code: 'EE302', name: 'Power System Analysis', credits: 3 },
    { code: 'EE303', name: 'Control Systems', credits: 3 },
    { code: 'EE304', name: 'Power Electronics', credits: 3 },
    { code: 'EE305', name: 'Electrical Drives Lab', credits: 2 }
  ],
  IT: [
    { code: 'IT301', name: 'Object Oriented Software Design', credits: 4 },
    { code: 'IT302', name: 'Cloud Computing Architecture', credits: 3 },
    { code: 'IT303', name: 'Information Security & Cryptography', credits: 3 },
    { code: 'IT304', name: 'Artificial Intelligence Basics', credits: 3 },
    { code: 'IT305', name: 'Full Stack Development Lab', credits: 2 }
  ]
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

async function seed() {
  console.log('🚀 Starting Local PostgreSQL High-Volume Database Seeding...');
  const startTime = Date.now();

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Seed Departments
    console.log('📁 1/5 Seeding 5 Departments...');
    const deptMap = {}; // code -> id
    for (const dept of DEPARTMENTS) {
      const res = await client.query(
        `INSERT INTO departments (code, name) VALUES ($1, $2)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, code;`,
        [dept.code, dept.name]
      );
      deptMap[res.rows[0].code] = res.rows[0].id;
    }

    // 2. Seed Subjects per Department and Semester (Sem 1 to 8)
    console.log('📚 2/5 Seeding Master Subjects per Department & Semester...');
    const subjectMap = {}; // deptCode_sem -> Array of subject IDs
    for (const deptCode of Object.keys(SUBJECT_TEMPLATES)) {
      const deptId = deptMap[deptCode];
      const templates = SUBJECT_TEMPLATES[deptCode];

      for (let sem = 1; sem <= 8; sem++) {
        const key = `${deptCode}_${sem}`;
        subjectMap[key] = [];

        for (let idx = 0; idx < templates.length; idx++) {
          const t = templates[idx];
          const code = `${t.code}-S${sem}`;
          const res = await client.query(
            `INSERT INTO subjects (code, subject_code, name, subject_name, department, department_id, semester, credits, total_periods)
             VALUES ($1, $1, $2, $2, $3, $4, $5, $6, 45)
             RETURNING id;`,
            [code, t.name, deptCode, deptId, sem, t.credits]
          );
          subjectMap[key].push(res.rows[0].id);
        }
      }
    }

    // 3. Seed Department-Wide Timetables (Periods 1 to 6 for Mon-Fri)
    console.log('📅 3/5 Seeding Pure Department Timetables (No user_id)...');
    await client.query('DELETE FROM timetable;'); // Fresh clean start for department timetables

    const timetableInserts = [];
    const timetableParams = [];
    let paramCounter = 1;

    for (const deptCode of Object.keys(SUBJECT_TEMPLATES)) {
      const deptId = deptMap[deptCode];
      for (let sem = 1; sem <= 8; sem++) {
        const subjects = subjectMap[`${deptCode}_${sem}`];

        for (const day of DAYS) {
          for (let period = 1; period <= 6; period++) {
            // Assign subject cyclically
            const subjectId = subjects[(period - 1) % subjects.length];
            const startTime = `${8 + period}:00`;
            const endTime = `${8 + period}:50`;
            const room = `Hall-${deptCode}-${100 + sem}`;

            timetableInserts.push(
              `($${paramCounter}, $${paramCounter + 1}, $${paramCounter + 2}, $${paramCounter + 3}, $${paramCounter + 4}, $${paramCounter + 5}, $${paramCounter + 6}, $${paramCounter + 7}, $${paramCounter + 8})`
            );
            timetableParams.push(deptId, deptCode, sem, day, period, subjectId, startTime, endTime, room);
            paramCounter += 9;
          }
        }
      }
    }

    if (timetableInserts.length > 0) {
      await client.query(
        `INSERT INTO timetable (department_id, department, semester, day, period, subject_id, start_time, end_time, room)
         VALUES ${timetableInserts.join(', ')};`,
        timetableParams
      );
    }

    // 4. Seed Admin Account & 500 Active Students
    console.log('👥 4/5 Seeding Admin Account & 500 Students...');
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const adminPassword = await bcrypt.hash('AdminPassword123!', 10);

    // Create Admin
    await client.query(
      `INSERT INTO users (name, register_number, email, password_hash, role, is_approved, is_suspended)
       VALUES ('System Admin', 'ADMIN001', 'admin@trackify.com', $1, 'admin', TRUE, FALSE)
       ON CONFLICT (email) DO NOTHING;`,
      [adminPassword]
    );

    const firstNames = ['Aarav', 'Aditi', 'Ananya', 'Bhavya', 'Chetan', 'Deepika', 'Eshwar', 'Gautam', 'Hari', 'Isha', 'Kavya', 'Karthik', 'Lakshmi', 'Manish', 'Naveen', 'Pooja', 'Rahul', 'Sanjay', 'Sneha', 'Vikram'];
    const lastNames = ['Sharma', 'Verma', 'Iyer', 'Patel', 'Reddy', 'Nair', 'Singh', 'Rao', 'Kumar', 'Gowda'];

    const studentRecords = [];
    const deptCodes = Object.keys(DEPARTMENTS.reduce((acc, d) => ({ ...acc, [d.code]: true }), {}));
    
    let studentCounter = 1;
    for (const deptCode of DEPARTMENTS.map(d => d.code)) {
      const deptId = deptMap[deptCode];

      for (let i = 1; i <= 100; i++) {
        const sem = ((i - 1) % 8) + 1; // Distribute students evenly across Semesters 1 to 8
        const regNo = `717823${deptCode}${String(i).padStart(3, '0')}`;
        const fn = firstNames[i % firstNames.length];
        const ln = lastNames[i % lastNames.length];
        const name = `${fn} ${ln}`;
        const email = `student${studentCounter}@trackify.com`;

        studentRecords.push({
          name,
          regNo,
          email,
          deptCode,
          deptId,
          sem
        });
        studentCounter++;
      }
    }

    // Batch insert 500 students
    console.log(` Inserting ${studentRecords.length} student user profiles...`);
    const studentUserIds = []; // [{ id, deptId, sem }]

    for (const s of studentRecords) {
      const res = await client.query(
        `INSERT INTO users (name, register_number, email, password_hash, role, department, department_id, semester, is_approved, is_suspended)
         VALUES ($1, $2, $3, $4, 'student', $5, $6, $7, TRUE, FALSE)
         ON CONFLICT (email) DO UPDATE SET department_id = EXCLUDED.department_id, semester = EXCLUDED.semester
         RETURNING id, department_id, semester;`,
        [s.name, s.regNo, s.email, hashedPassword, s.deptCode, s.deptId, s.sem]
      );
      const createdStudent = res.rows[0];
      studentUserIds.push(createdStudent);

      // Create settings record
      await client.query(
        `INSERT INTO settings (user_id, minimum_attendance, theme, notifications)
         VALUES ($1, 80, 'light', TRUE)
         ON CONFLICT (user_id) DO NOTHING;`,
        [createdStudent.id]
      );
    }

    // 5. Seed 1 Month of Attendance Records for all 500 students
    console.log('📊 5/5 Generating 1 Month of Attendance Records (~20,000+ entries)...');
    await client.query('DELETE FROM attendance;'); // Clean start for deterministic attendance metrics

    // Pre-fetch all timetable slots by department_id and semester
    const ttRes = await client.query(
      `SELECT department_id, semester, day, period, subject_id FROM timetable;`
    );
    const ttByDeptSemDay = {}; // `${deptId}_${sem}_${day}` -> Array of slots
    for (const row of ttRes.rows) {
      const key = `${row.department_id}_${row.semester}_${row.day}`;
      if (!ttByDeptSemDay[key]) ttByDeptSemDay[key] = [];
      ttByDeptSemDay[key].push(row);
    }

    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const attendanceBatches = [];
    const attendanceParams = [];
    let attParamCount = 1;

    let totalAttendanceInserted = 0;

    for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
      const dateObj = new Date(today);
      dateObj.setDate(today.getDate() - dayOffset);
      const dateStr = dateObj.toISOString().split('T')[0];
      const dayName = dayNames[dateObj.getDay()];

      // Skip Sundays
      if (dayName === 'Sunday') continue;

      for (const student of studentUserIds) {
        const key = `${student.department_id}_${student.semester}_${dayName}`;
        const slots = ttByDeptSemDay[key] || [];

        for (const slot of slots) {
          // Weighted realistic attendance status generator
          const rand = Math.random();
          let status = 'Present';
          let remarks = 'Attended class';

          if (rand > 0.88) {
            status = 'Absent';
            remarks = 'Unexcused absence';
          } else if (rand > 0.84) {
            status = 'On Duty';
            remarks = 'College Sports/Symposium OD';
          } else if (rand > 0.82) {
            status = 'Medical Leave';
            remarks = 'Medical leave certificate submitted';
          }

          attendanceBatches.push(
            `($${attParamCount}, $${attParamCount + 1}, $${attParamCount + 2}, $${attParamCount + 3}, $${attParamCount + 4}, $${attParamCount + 5})`
          );
          attendanceParams.push(student.id, slot.subject_id, dateStr, slot.period, status, remarks);
          attParamCount += 6;
          totalAttendanceInserted++;

          // Flush batch in chunks of 5,000 rows to optimize PostgreSQL query memory
          if (attendanceBatches.length >= 5000) {
            await client.query(
              `INSERT INTO attendance (user_id, subject_id, date, period, status, remarks)
               VALUES ${attendanceBatches.join(', ')}
               ON CONFLICT (user_id, date, period) DO NOTHING;`,
              attendanceParams
            );
            attendanceBatches.length = 0;
            attendanceParams.length = 0;
            attParamCount = 1;
          }
        }
      }
    }

    // Flush remaining attendance records
    if (attendanceBatches.length > 0) {
      await client.query(
        `INSERT INTO attendance (user_id, subject_id, date, period, status, remarks)
         VALUES ${attendanceBatches.join(', ')}
         ON CONFLICT (user_id, date, period) DO NOTHING;`,
        attendanceParams
      );
    }

    await client.query('COMMIT');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ High-Volume Local PostgreSQL Database Seeding Completed in ${duration}s!`);
    console.log(`📈 Summary:`);
    console.log(` - 📁 5 Departments Created`);
    console.log(` - 📚 Master Subjects Created`);
    console.log(` - 📅 Pure Department Timetable Slots Created`);
    console.log(` - 👥 500 Active Students & 1 Admin Account Created`);
    console.log(` - 📊 ${totalAttendanceInserted} Attendance Logs Seeded across past 30 days!`);
    console.log(`\n🔑 Login Credentials:`);
    console.log(` - Admin:   admin@trackify.com | Password: AdminPassword123!`);
    console.log(` - Student: student1@trackify.com | Password: Password123!`);

    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during local DB seeding:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

seed();
