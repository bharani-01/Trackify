const db = require('../backend/src/config/db');
const subjectRepository = require('../backend/src/repositories/subjectRepository');
const timetableRepository = require('../backend/src/repositories/timetableRepository');
const attendanceRepository = require('../backend/src/repositories/attendanceRepository');

async function checkAadil() {
  const client = await db.pool.connect();
  try {
    console.log('=== [READ-ONLY QUERY] CHECKING USER: Àádīl Àhmēd ===\n');

    // 1. Search for user with case-insensitive / accent-insensitive matching
    const userRes = await client.query(`
      SELECT id, name, email, register_number, role, department, semester, department_id, is_approved, created_at
      FROM users
      WHERE name ILIKE '%Aadil%' OR name ILIKE '%Ahmed%' OR name ILIKE '%Àádīl%' OR email ILIKE '%aadil%' OR email ILIKE '%ahmed%';
    `);

    if (userRes.rows.length === 0) {
      console.log('No user found matching Aadil / Ahmed. Listing all student users:');
      const allUsers = await client.query('SELECT id, name, email, department, semester FROM users WHERE role = \'student\' ORDER BY name ASC;');
      console.table(allUsers.rows);
      return;
    }

    console.log('Found User Profile:');
    console.table(userRes.rows);

    const user = userRes.rows[0];

    // 2. Fetch subject list via subjectRepository.getAllByUserId
    const subjects = await subjectRepository.getAllByUserId(user.id);
    console.log(`\n1. Subjects from subjectRepository.getAllByUserId (${subjects.length} subjects):`);
    console.table(subjects.map(s => ({
      id: s.id,
      code: s.subject_code,
      name: s.subject_name,
      credits: s.credits,
      periods: s.total_periods,
      color: s.color
    })));

    // 3. Fetch attendance stats via attendanceRepository.getSubjectStats
    const stats = await attendanceRepository.getSubjectStats(user.id);
    console.log(`\n2. Attendance Stats from attendanceRepository.getSubjectStats (${stats.length} subjects):`);
    console.table(stats.map(s => ({
      code: s.subject_code,
      name: s.subject_name,
      present: s.present_count,
      absent: s.absent_count,
      od: s.od_count,
      medical: s.medical_count,
      holiday: s.holiday_count,
      conducted: s.conducted_count
    })));

    // 4. Fetch timetable via timetableRepository.getByUserId
    const tt = await timetableRepository.getByUserId(user.id);
    console.log(`\n3. Timetable Slots from timetableRepository.getByUserId (${tt.length} slots):`);
    
    // Group timetable slots by day
    const dayMap = {};
    tt.forEach(slot => {
      dayMap[slot.day] = dayMap[slot.day] || [];
      dayMap[slot.day].push(`P${slot.period}: ${slot.subject_code} (${slot.start_time}-${slot.end_time})`);
    });
    console.log(dayMap);

    // 5. Total attendance records in DB
    const attCount = await client.query('SELECT COUNT(*) as total_attendance_logs FROM attendance WHERE user_id = $1', [user.id]);
    console.log(`\n4. Total Attendance Records Logged in DB: ${attCount.rows[0].total_attendance_logs}`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

checkAadil();
