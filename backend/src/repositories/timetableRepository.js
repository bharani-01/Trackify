const db = require('../config/db');

/**
 * Retrieve pure department timetable slots for a specific student
 * Maps student's department_id and semester to the department timetable
 * @param {string} userId 
 * @returns {Promise<Array>}
 */
const getByUserId = async (userId) => {
  const query = `
    SELECT 
      t.id,
      t.subject_id,
      t.day,
      t.period,
      t.start_time,
      t.end_time,
      t.room,
      COALESCE(s.subject_name, s.name) AS subject_name,
      COALESCE(s.subject_code, s.code) AS subject_code,
      s.color,
      s.credits
    FROM users u
    JOIN timetable t ON (t.department_id = u.department_id OR (u.department_id IS NULL AND t.department = u.department))
                    AND t.semester = u.semester
    LEFT JOIN subjects s ON t.subject_id = s.id
    WHERE u.id = $1
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
  const result = await db.query(query, [userId]);
  return result.rows;
};

/**
 * Create a new department timetable slot (Admin operation)
 */
const create = async (slot) => {
  const { department_id, department, semester, subject_id, day, period, start_time, end_time, room } = slot;
  const query = `
    INSERT INTO timetable (department_id, department, semester, subject_id, day, period, start_time, end_time, room)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
  const result = await db.query(query, [
    department_id || null,
    department || null,
    parseInt(semester, 10),
    subject_id,
    day,
    parseInt(period, 10),
    start_time,
    end_time,
    room ? room.trim() : null
  ]);
  return result.rows[0];
};

/**
 * Update department timetable slot details
 */
const update = async (id, slot) => {
  const { subject_id, day, period, start_time, end_time, room } = slot;
  const query = `
    UPDATE timetable
    SET subject_id = $1, day = $2, period = $3, start_time = $4, end_time = $5, room = $6
    WHERE id = $7
    RETURNING *
  `;
  const result = await db.query(query, [
    subject_id,
    day,
    parseInt(period, 10),
    start_time,
    end_time,
    room ? room.trim() : null,
    id
  ]);
  return result.rows[0] || null;
};

/**
 * Delete a department timetable slot
 */
const deleteSlot = async (id) => {
  const query = 'DELETE FROM timetable WHERE id = $1 RETURNING id';
  const result = await db.query(query, [id]);
  return result.rowCount > 0;
};

/**
 * Legacy compatibility stub: Department timetables require no per-student copying.
 */
const copyMasterTimetable = async () => {
  return true;
};

module.exports = {
  getByUserId,
  create,
  update,
  delete: deleteSlot,
  copyMasterTimetable
};
