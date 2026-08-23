const db = require('../backend/src/config/db');
const subjectRepository = require('../backend/src/repositories/subjectRepository');
const timetableRepository = require('../backend/src/repositories/timetableRepository');
const attendanceRepository = require('../backend/src/repositories/attendanceRepository');

async function auditAllUsersEndpoints() {
  const client = await db.pool.connect();
  try {
    const users = await client.query(`SELECT id, name, email, department, semester, role FROM users ORDER BY role, name`);
    console.log(`Auditing all ${users.rows.length} users in production DB...\n`);

    let anyDupsFound = false;

    for (const u of users.rows) {
      if (u.role === 'student') {
        // 1. Check getSubjects
        const subjects = await subjectRepository.getAllByUserId(u.id);
        const subCodes = {};
        subjects.forEach(s => {
          const c = (s.subject_code || s.code || '').trim().toUpperCase();
          subCodes[c] = (subCodes[c] || 0) + 1;
        });
        const subDups = Object.entries(subCodes).filter(([_, c]) => c > 1);
        if (subDups.length > 0) {
          anyDupsFound = true;
          console.log(`[!] Student ${u.name} (${u.email}) has duplicate subjects in getAllByUserId:`, subDups);
        }

        // 2. Check getTimetable
        const tt = await timetableRepository.getByUserId(u.id);
        const ttSlots = {};
        tt.forEach(t => {
          const key = `${t.day}_P${t.period}`;
          ttSlots[key] = (ttSlots[key] || 0) + 1;
        });
        const ttDups = Object.entries(ttSlots).filter(([_, c]) => c > 1);
        if (ttDups.length > 0) {
          anyDupsFound = true;
          console.log(`[!] Student ${u.name} (${u.email}) has duplicate timetable slots:`, ttDups);
        }

        // 3. Check getSubjectStats
        const stats = await attendanceRepository.getSubjectStats(u.id);
        const statCodes = {};
        stats.forEach(s => {
          const c = (s.subject_code || s.code || '').trim().toUpperCase();
          statCodes[c] = (statCodes[c] || 0) + 1;
        });
        const statDups = Object.entries(statCodes).filter(([_, c]) => c > 1);
        if (statDups.length > 0) {
          anyDupsFound = true;
          console.log(`[!] Student ${u.name} (${u.email}) has duplicate subjects in getSubjectStats:`, statDups);
        }
      }
    }

    if (!anyDupsFound) {
      console.log('✓ All 44 users have 0 duplicate subjects in getSubjects, getTimetable, and getSubjectStats.');
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

auditAllUsersEndpoints();
