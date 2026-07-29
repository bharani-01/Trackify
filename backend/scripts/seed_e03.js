const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const SUBJECTS = [
  { code: 'CSE23CT301', name: 'Computer Networks', credits: 3, color: '#f97316' },
  { code: 'ADA23DEU04', name: 'Natural Language Processing', credits: 3, color: '#14b8a6' },
  { code: 'ADA23CL302', name: 'Data Mining Laboratory (AIDA Lab)', credits: 2, color: '#06b6d4' },
  { code: 'ADA23CL301', name: 'Deep Learning Laboratory', credits: 2, color: '#10b981' },
  { code: 'CSE23AE301', name: 'Professional Competency Development - V', credits: 2, color: '#f59e0b' },
  { code: 'CLUB_ACT', name: 'Club Activity', credits: 1, color: '#84cc16' },
  { code: 'CSE23AE302', name: 'Professional Coding Practice IV', credits: 2, color: '#3b82f6' },
  { code: 'CSE23CT302', name: 'Theory of Computation and Compiler Design', credits: 4, color: '#6366f1' },
  { code: 'ADA23CT302', name: 'Data Mining', credits: 3, color: '#ec4899' },
  { code: 'ADA23DLU04', name: 'Natural Language Processing Laboratory (AIDA Lab)', credits: 2, color: '#8b5cf6' },
  { code: 'MENTOR_MEET', name: 'Mentor-Mentee Meeting', credits: 1, color: '#6b7280' },
  { code: 'ADA23SLU07', name: 'Research Productivity Tools', credits: 2, color: '#a855f7' },
  { code: 'CSE23CL301', name: 'Computer Networks Laboratory', credits: 2, color: '#059669' },
  { code: 'ADA23CT301', name: 'Deep Learning', credits: 4, color: '#ef4444' }
];

const TIMETABLE_SLOTS = [
  // Monday
  { day: 'Monday', period: 1, code: 'CSE23CT301', start: '08:00:00', end: '08:55:00', room: 'CR 8' },
  { day: 'Monday', period: 2, code: 'ADA23DEU04', start: '08:55:00', end: '09:50:00', room: 'CR 8' },
  { day: 'Monday', period: 3, code: 'ADA23CL302', start: '10:10:00', end: '11:05:00', room: 'CR 8' },
  { day: 'Monday', period: 4, code: 'ADA23CL302', start: '11:05:00', end: '12:00:00', room: 'CR 8' },
  { day: 'Monday', period: 5, code: 'CSE23AE302', start: '13:00:00', end: '13:50:00', room: 'CR 8' },
  { day: 'Monday', period: 6, code: 'CSE23AE302', start: '13:50:00', end: '14:40:00', room: 'CR 8' },
  { day: 'Monday', period: 7, code: 'CSE23CT302', start: '14:55:00', end: '15:45:00', room: 'CR 8' },

  // Tuesday
  { day: 'Tuesday', period: 1, code: 'ADA23CT302', start: '08:00:00', end: '08:55:00', room: 'CR 8' },
  { day: 'Tuesday', period: 2, code: 'ADA23DEU04', start: '08:55:00', end: '09:50:00', room: 'CR 8' },
  { day: 'Tuesday', period: 3, code: 'ADA23CL301', start: '10:10:00', end: '11:05:00', room: 'CR 8' },
  { day: 'Tuesday', period: 4, code: 'ADA23CL301', start: '11:05:00', end: '12:00:00', room: 'CR 8' },
  { day: 'Tuesday', period: 5, code: 'CSE23AE301', start: '13:00:00', end: '13:50:00', room: 'CR 8' },
  { day: 'Tuesday', period: 6, code: 'CSE23AE301', start: '13:50:00', end: '14:40:00', room: 'CR 8' },
  { day: 'Tuesday', period: 7, code: 'CSE23CT302', start: '14:55:00', end: '15:45:00', room: 'CR 8' },

  // Wednesday
  { day: 'Wednesday', period: 1, code: 'ADA23DLU04', start: '08:00:00', end: '08:55:00', room: 'CR 8' },
  { day: 'Wednesday', period: 2, code: 'ADA23DLU04', start: '08:55:00', end: '09:50:00', room: 'CR 8' },
  { day: 'Wednesday', period: 3, code: 'CSE23AE301', start: '10:10:00', end: '11:05:00', room: 'CR 8' },
  { day: 'Wednesday', period: 4, code: 'CLUB_ACT', start: '11:05:00', end: '12:00:00', room: 'CR 8' },
  { day: 'Wednesday', period: 5, code: 'CSE23CT301', start: '13:00:00', end: '13:50:00', room: 'CR 8' },
  { day: 'Wednesday', period: 6, code: 'ADA23CT301', start: '13:50:00', end: '14:40:00', room: 'CR 8' },
  { day: 'Wednesday', period: 7, code: 'CSE23CT301', start: '14:55:00', end: '15:45:00', room: 'CR 8' },

  // Thursday
  { day: 'Thursday', period: 1, code: 'ADA23CT302', start: '08:00:00', end: '08:55:00', room: 'CR 8' },
  { day: 'Thursday', period: 2, code: 'MENTOR_MEET', start: '08:55:00', end: '09:50:00', room: 'CR 8' },
  { day: 'Thursday', period: 3, code: 'ADA23CT302', start: '10:10:00', end: '11:05:00', room: 'CR 8' },
  { day: 'Thursday', period: 4, code: 'CSE23CT302', start: '11:05:00', end: '12:00:00', room: 'CR 8' },
  { day: 'Thursday', period: 5, code: 'CSE23CT302', start: '13:00:00', end: '13:50:00', room: 'CR 8' },
  { day: 'Thursday', period: 6, code: 'ADA23CT301', start: '13:50:00', end: '14:40:00', room: 'CR 8' },
  { day: 'Thursday', period: 7, code: 'ADA23DEU04', start: '14:55:00', end: '15:45:00', room: 'CR 8' },

  // Friday
  { day: 'Friday', period: 1, code: 'CSE23CL301', start: '08:00:00', end: '08:55:00', room: 'CR 8' },
  { day: 'Friday', period: 2, code: 'CSE23CL301', start: '08:55:00', end: '09:50:00', room: 'CR 8' },
  { day: 'Friday', period: 3, code: 'CSE23AE302', start: '10:10:00', end: '11:05:00', room: 'CR 8' },
  { day: 'Friday', period: 4, code: 'CSE23AE302', start: '11:05:00', end: '12:00:00', room: 'CR 8' },
  { day: 'Friday', period: 5, code: 'ADA23SLU07', start: '13:00:00', end: '13:50:00', room: 'CR 8' },
  { day: 'Friday', period: 6, code: 'ADA23SLU07', start: '13:50:00', end: '14:40:00', room: 'CR 8' },
  { day: 'Friday', period: 7, code: 'ADA23CT301', start: '14:55:00', end: '15:45:00', room: 'CR 8' },

  // Saturday
  { day: 'Saturday', period: 1, code: 'CSE23CT301', start: '08:00:00', end: '08:55:00', room: 'CR 8' },
  { day: 'Saturday', period: 2, code: 'MENTOR_MEET', start: '08:55:00', end: '09:50:00', room: 'CR 8' },
  { day: 'Saturday', period: 3, code: 'CSE23CT302', start: '10:10:00', end: '11:05:00', room: 'CR 8' },
  { day: 'Saturday', period: 4, code: 'ADA23SLU07', start: '11:05:00', end: '12:00:00', room: 'CR 8' },
  { day: 'Saturday', period: 5, code: 'ADA23DEU04', start: '13:00:00', end: '13:50:00', room: 'CR 8' },
  { day: 'Saturday', period: 6, code: 'ADA23CT301', start: '13:50:00', end: '14:40:00', room: 'CR 8' },
  { day: 'Saturday', period: 7, code: 'ADA23CT302', start: '14:55:00', end: '15:45:00', room: 'CR 8' }
];

async function seedE03() {
  console.log('🚀 Starting Safe Zero-Deletion Seeding of Department E03...');
  const client = await pool.connect();
  
  try {
    // 1. Ensure department E03 exists
    console.log('📁 Step 1: Checking/Creating Department E03...');
    let deptRes = await client.query("SELECT id FROM departments WHERE code = 'E03'");
    let deptId;
    if (deptRes.rows.length === 0) {
      const insertDept = await client.query(
        "INSERT INTO departments (code, name) VALUES ('E03', 'B.Tech CSE (AIDA) - Batch II') RETURNING id"
      );
      deptId = insertDept.rows[0].id;
      console.log(`✅ Created Department E03 with ID: ${deptId}`);
    } else {
      deptId = deptRes.rows[0].id;
      console.log(`ℹ️ Department E03 already exists with ID: ${deptId}`);
    }

    // 2. Seed/Update subjects
    console.log('📚 Step 2: Seeding/Updating E03 Sem 5 Subjects...');
    const subjectMap = {}; // code -> subject UUID
    for (const sub of SUBJECTS) {
      let subRes = await client.query(
        "SELECT id FROM subjects WHERE department_id = $1 AND semester = 5 AND subject_code = $2 AND user_id IS NULL",
        [deptId, sub.code]
      );
      
      let subjectId;
      if (subRes.rows.length > 0) {
        subjectId = subRes.rows[0].id;
        await client.query(
          `UPDATE subjects SET subject_name = $1, name = $1, credits = $2, color = $3 
           WHERE id = $4`,
          [sub.name, sub.credits, sub.color, subjectId]
        );
        console.log(`ℹ️ Subject ${sub.code} already exists, updated details. ID: ${subjectId}`);
      } else {
        const insertSub = await client.query(
          `INSERT INTO subjects (user_id, subject_code, subject_name, code, name, credits, color, department, department_id, semester)
           VALUES (NULL, $1, $2, $1, $2, $3, $4, 'E03', $5, 5)
           RETURNING id`,
          [sub.code, sub.name, sub.credits, sub.color, deptId]
        );
        subjectId = insertSub.rows[0].id;
        console.log(`✅ Created Subject ${sub.code} (${sub.name}) -> ID: ${subjectId}`);
      }
      subjectMap[sub.code] = subjectId;
    }

    // 3. Seed/Update timetable slots
    console.log('📅 Step 3: Seeding/Updating E03 Sem 5 Timetable Slots...');
    let slotsHandled = 0;
    for (const slot of TIMETABLE_SLOTS) {
      const subjectUuid = subjectMap[slot.code];
      if (!subjectUuid) {
        throw new Error(`Subject with code ${slot.code} not found in seeded map!`);
      }

      let slotRes = await client.query(
        "SELECT id FROM timetable WHERE department_id = $1 AND semester = 5 AND day = $2 AND period = $3",
        [deptId, slot.day, slot.period]
      );

      if (slotRes.rows.length > 0) {
        const slotId = slotRes.rows[0].id;
        await client.query(
          `UPDATE timetable SET subject_id = $1, start_time = $2, end_time = $3, room = $4
           WHERE id = $5`,
          [subjectUuid, slot.start, slot.end, slot.room, slotId]
        );
        console.log(`ℹ️ Timetable slot for ${slot.day} Period ${slot.period} updated.`);
      } else {
        await pool.query(
          `INSERT INTO timetable (department_id, department, semester, day, period, subject_id, start_time, end_time, room)
           VALUES ($1, 'E03', 5, $2, $3, $4, $5, $6, $7)`,
          [deptId, slot.day, slot.period, subjectUuid, slot.start, slot.end, slot.room]
        );
        console.log(`✅ Created Timetable slot for ${slot.day} Period ${slot.period}.`);
      }
      slotsHandled++;
    }
    console.log(`✅ Handled ${slotsHandled} timetable slots successfully.`);
    console.log('🎉 E03 seeding completed successfully without any deletions!');
  } catch (error) {
    console.error('❌ Error during E03 seeding:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seedE03();
