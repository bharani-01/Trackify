const db = require('../config/db');

/**
 * Get all student users
 * @returns {Promise<Array>}
 */
const getStudents = async () => {
  const query = `
    SELECT u.id, u.name, u.register_number, u.email, u.department, u.semester, u.is_suspended, u.is_approved, u.created_at,
           s.minimum_attendance, s.notifications
    FROM users u
    LEFT JOIN settings s ON u.id = s.user_id
    WHERE u.role = 'student' AND (u.is_approved IS TRUE OR u.is_approved IS NULL)
    ORDER BY u.name ASC
  `;
  const result = await db.query(query);
  return result.rows;
};

/**
 * Get all administrator users
 * @returns {Promise<Array>}
 */
const getAdmins = async () => {
  const query = `
    SELECT u.id, u.name, u.email, u.role, u.is_suspended, u.is_approved, u.created_at
    FROM users u
    WHERE u.role = 'admin'
    ORDER BY u.name ASC
  `;
  const result = await db.query(query);
  return result.rows;
};

/**
 * Toggle user suspension status
 * @param {string} userId 
 * @param {boolean} isSuspended 
 * @returns {Promise<boolean>}
 */
const setSuspension = async (userId, isSuspended) => {
  const query = 'UPDATE users SET is_suspended = $1 WHERE id = $2 RETURNING id';
  const result = await db.query(query, [isSuspended, userId]);
  return result.rowCount > 0;
};

/**
 * Delete a user
 * @param {string} userId 
 * @returns {Promise<boolean>}
 */
const deleteUser = async (userId) => {
  const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
  const result = await db.query(query, [userId]);
  return result.rowCount > 0;
};

/**
 * Get global stats & dashboard widgets data for Admin Dashboard
 * @returns {Promise<object>}
 */
const getStats = async () => {
  // 1. User counts (Only approved and non-suspended count as Active)
  const countQuery = `
    SELECT 
      COUNT(*)::int AS total_students,
      SUM(CASE WHEN is_suspended = FALSE AND (is_approved IS TRUE OR is_approved IS NULL) THEN 1 ELSE 0 END)::int AS active_students,
      SUM(CASE WHEN is_suspended = TRUE OR is_approved = FALSE THEN 1 ELSE 0 END)::int AS suspended_students
    FROM users
    WHERE role = 'student'
  `;
  const countsResult = await db.query(countQuery);
  const counts = countsResult.rows[0];

  // 2. Global average attendance percentage
  const avgQuery = `
    SELECT COALESCE(AVG(percentage), 0)::float AS overall_avg
    FROM (
      SELECT 
        user_id,
        (SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END)::float / 
         NULLIF(SUM(CASE WHEN status IN ('Present', 'Absent') THEN 1 ELSE 0 END), 0)) * 100 AS percentage
      FROM attendance
      GROUP BY user_id
    ) user_percentages
  `;
  const avgResult = await db.query(avgQuery);
  const overallAvg = avgResult.rows[0].overall_avg;

  // 3. Pending Registration Requests (Unapproved sign-ups)
  const pendingQuery = `
    SELECT u.id, u.name, u.register_number, u.email, u.department, u.semester, u.is_suspended, u.is_approved, u.created_at
    FROM users u
    WHERE u.role = 'student' AND u.is_approved = FALSE
    ORDER BY u.created_at DESC
  `;
  const pendingResult = await db.query(pendingQuery);

  // 4. Suspended Accounts List
  const suspendedQuery = `
    SELECT u.id, u.name, u.register_number, u.email, u.department, u.semester, u.is_suspended, u.is_approved, u.created_at
    FROM users u
    WHERE u.role = 'student' AND u.is_suspended = TRUE AND (u.is_approved IS TRUE OR u.is_approved IS NULL)
    ORDER BY u.name ASC
  `;
  const suspendedResult = await db.query(suspendedQuery);

  // 4. Low Attendance Defaulters List (< 80%)
  const defaultersQuery = `
    SELECT * FROM (
      SELECT u.id, u.name, u.register_number, u.email, u.department, u.semester,
             COALESCE(
               ROUND(
                 (SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::numeric / 
                  NULLIF(SUM(CASE WHEN a.status IN ('Present', 'Absent') THEN 1 ELSE 0 END), 0)) * 100, 1
               ), 0
             )::float AS attendance_pct,
             COUNT(a.id)::int AS total_records
      FROM users u
      LEFT JOIN attendance a ON u.id = a.user_id
      WHERE u.role = 'student' AND u.is_approved = TRUE AND u.is_suspended = FALSE
      GROUP BY u.id, u.name, u.register_number, u.email, u.department, u.semester
    ) student_stats
    WHERE student_stats.total_records > 0 AND student_stats.attendance_pct < 80
    ORDER BY student_stats.attendance_pct ASC
    LIMIT 10
  `;
  const defaultersResult = await db.query(defaultersQuery);

  // 5. Recent System Audit Trail
  const auditQuery = `
    SELECT al.id, al.action, al.details, al.created_at, u.name as user_name
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ORDER BY al.created_at DESC
    LIMIT 5
  `;
  const auditResult = await db.query(auditQuery);

  return {
    total_students: counts.total_students || 0,
    active_students: counts.active_students || 0,
    suspended_students: counts.suspended_students || 0,
    overall_avg_attendance: Math.round(overallAvg * 10) / 10,
    pending_registrations: pendingResult.rows || [],
    suspended_users: suspendedResult.rows || [],
    defaulters: defaultersResult.rows || [],
    recent_activity: auditResult.rows || []
  };
};

/**
 * Retrieve master subjects templates for admin timetabling
 */
const getMasterSubjects = async (department, semester) => {
  const query = `
    SELECT * FROM subjects 
    WHERE user_id IS NULL AND department = $1 AND semester = $2
    ORDER BY subject_name ASC
  `;
  const result = await db.query(query, [department, parseInt(semester, 10)]);
  return result.rows;
};

/**
 * Create a new master subject template
 */
const createMasterSubject = async (subject) => {
  const { subject_code, subject_name, credits, color, department, semester, total_periods } = subject;
  const query = `
    INSERT INTO subjects (user_id, subject_code, subject_name, credits, color, department, semester, total_periods)
    VALUES (NULL, $1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const result = await db.query(query, [
    subject_code.trim().toUpperCase(),
    subject_name.trim(),
    parseInt(credits, 10),
    color || '#3b82f6',
    department,
    parseInt(semester, 10),
    total_periods ? parseInt(total_periods, 10) : 45
  ]);
  return result.rows[0];
};

/**
 * Update total hours for a master subject and propagate it to all students in that cohort
 */
const updateCohortSubjectHours = async (department, semester, subjectCode, totalPeriods) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update the master subject template
    await client.query(`
      UPDATE subjects 
      SET total_periods = $1 
      WHERE user_id IS NULL AND department = $2 AND semester = $3 AND subject_code = $4
    `, [totalPeriods, department, semester, subjectCode]);

    // 2. Propagate to all active student subjects in this department/semester cohort
    await client.query(`
      UPDATE subjects 
      SET total_periods = $1 
      WHERE user_id IS NOT NULL 
        AND subject_code = $4 
        AND user_id IN (
          SELECT id FROM users WHERE department = $2 AND semester = $3 AND role = 'student'
        )
    `, [totalPeriods, department, semester, subjectCode]);

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Delete master subject template
 */
const deleteMasterSubject = async (id) => {
  const query = 'DELETE FROM subjects WHERE id = $1 AND user_id IS NULL RETURNING id';
  const result = await db.query(query, [id]);
  return result.rowCount > 0;
};

/**
 * Retrieve master timetable templates
 */
const getMasterTimetable = async (department, semester) => {
  const query = `
    SELECT t.*, s.subject_name, s.subject_code, s.color
    FROM timetable t
    JOIN subjects s ON t.subject_id = s.id
    WHERE t.user_id IS NULL AND t.department = $1 AND t.semester = $2
    ORDER BY 
      CASE t.day
        WHEN 'Monday' THEN 1
        WHEN 'Tuesday' THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4
        WHEN 'Friday' THEN 5
        WHEN 'Saturday' THEN 6
        WHEN 'Sunday' THEN 7
      END,
      t.period ASC
  `;
  const result = await db.query(query, [department, parseInt(semester, 10)]);
  return result.rows;
};

/**
 * Create a master timetable slot template
 */
const createMasterTimetableSlot = async (slot) => {
  const { subject_id, day, period, start_time, end_time, room, department, semester } = slot;
  const query = `
    INSERT INTO timetable (user_id, subject_id, day, period, start_time, end_time, room, department, semester)
    VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const result = await db.query(query, [
    subject_id,
    day,
    parseInt(period, 10),
    start_time,
    end_time,
    room ? room.trim() : null,
    department,
    parseInt(semester, 10)
  ]);
  return result.rows[0];
};

/**
 * Delete master timetable slot template
 */
const deleteMasterTimetableSlot = async (id) => {
  const query = 'DELETE FROM timetable WHERE id = $1 AND user_id IS NULL RETURNING id';
  const result = await db.query(query, [id]);
  return result.rowCount > 0;
};

/**
 * Update student profile (department and semester)
 */
const updateStudentProfile = async (userId, department, semester) => {
  const query = 'UPDATE users SET department = $1, semester = $2 WHERE id = $3 RETURNING id';
  const result = await db.query(query, [department, semester, userId]);
  return result.rowCount > 0;
};

/**
 * Initialize (or clear and copy) student master subjects and timetable
 */
const initializeStudentSubjectsAndTimetable = async (userId, department, semester) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Clear old timetable and subjects to avoid conflicts/duplicates
    await client.query('DELETE FROM timetable WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM subjects WHERE user_id = $1', [userId]);

    // Import repositories to copy templates
    const subjectRepository = require('./subjectRepository');
    const timetableRepository = require('./timetableRepository');

    // 2. Copy Master Subjects and get the Subject Mapping
    const subjectMap = await subjectRepository.copyMasterSubjects(
      client,
      userId,
      department,
      semester
    );

    // 3. Copy Master Timetable using the Subject Mapping
    await timetableRepository.copyMasterTimetable(
      client,
      userId,
      department,
      semester,
      subjectMap
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getStudents,
  getAdmins,
  setSuspension,
  deleteUser,
  updateStudentProfile,
  initializeStudentSubjectsAndTimetable,
  getStats,
  getMasterSubjects,
  createMasterSubject,
  deleteMasterSubject,
  getMasterTimetable,
  createMasterTimetableSlot,
  deleteMasterTimetableSlot,
  updateCohortSubjectHours
};
