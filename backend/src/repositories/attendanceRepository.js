const db = require('../config/db');

/**
 * Get attendance logs for a student with filters
 * @param {string} userId 
 * @param {object} filters - { startDate, endDate, subjectId }
 * @returns {Promise<Array>}
 */
const getByUserId = async (userId, filters = {}) => {
  const { startDate, endDate, subjectId } = filters;
  let query = `
    SELECT a.*, COALESCE(s.subject_name, s.name) AS subject_name, COALESCE(s.subject_code, s.code) AS subject_code, s.color
    FROM attendance a
    JOIN subjects s ON a.subject_id = s.id
    WHERE a.user_id = $1
  `;
  const params = [userId];
  let paramIdx = 2;

  if (startDate) {
    query += ` AND a.date >= $${paramIdx++}`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND a.date <= $${paramIdx++}`;
    params.push(endDate);
  }

  if (subjectId) {
    query += ` AND a.subject_id = $${paramIdx++}`;
    params.push(subjectId);
  }

  query += ' ORDER BY a.date DESC, a.created_at DESC';
  const result = await db.query(query, params);
  return result.rows;
};

/**
 * Log attendance record
 * @param {object} record - { user_id, subject_id, date, status, remarks }
 * @returns {Promise<object>}
 */
const create = async (record) => {
  const { user_id, subject_id, date, status, remarks } = record;
  const query = `
    INSERT INTO attendance (user_id, subject_id, date, status, remarks)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const result = await db.query(query, [
    user_id,
    subject_id,
    date,
    status,
    remarks ? remarks.trim() : null
  ]);
  return result.rows[0];
};

/**
 * Update attendance log
 * @param {string} id 
 * @param {string} userId 
 * @param {object} record - { status, remarks }
 * @returns {Promise<object|null>}
 */
const update = async (id, userId, record) => {
  const { status, remarks } = record;
  const query = `
    UPDATE attendance
    SET status = $1, remarks = $2
    WHERE id = $3 AND user_id = $4
    RETURNING *
  `;
  const result = await db.query(query, [status, remarks ? remarks.trim() : null, id, userId]);
  return result.rows[0] || null;
};

/**
 * Delete attendance log
 * @param {string} id 
 * @param {string} userId 
 * @returns {Promise<boolean>}
 */
const deleteRecord = async (id, userId) => {
  const query = 'DELETE FROM attendance WHERE id = $1 AND user_id = $2 RETURNING id';
  const result = await db.query(query, [id, userId]);
  return result.rowCount > 0;
};

/**
 * Get subject-wise attendance aggregation statistics for a student
 * @param {string} userId 
 * @returns {Promise<Array>} Stats for each subject
 */
const getSubjectStats = async (userId) => {
  const query = `
    SELECT 
      s.id AS subject_id,
      COALESCE(s.subject_code, s.code) AS subject_code,
      COALESCE(s.subject_name, s.name) AS subject_name,
      s.credits,
      s.color,
      s.total_periods,
      COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0)::int AS present_count,
      COALESCE(SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END), 0)::int AS absent_count,
      COALESCE(SUM(CASE WHEN a.status = 'Medical Leave' THEN 1 ELSE 0 END), 0)::int AS medical_count,
      COALESCE(SUM(CASE WHEN a.status = 'Holiday' THEN 1 ELSE 0 END), 0)::int AS holiday_count,
      COALESCE(SUM(CASE WHEN a.status = 'On Duty' THEN 1 ELSE 0 END), 0)::int AS od_count,
      COALESCE(SUM(CASE WHEN a.status IN ('Present', 'Absent', 'On Duty') THEN 1 ELSE 0 END), 0)::int AS conducted_count
    FROM users u
    JOIN subjects s ON (s.department_id = u.department_id OR (u.department_id IS NULL AND s.department = u.department))
                    AND s.semester = u.semester
    LEFT JOIN attendance a ON s.id = a.subject_id AND a.user_id = u.id
    WHERE u.id = $1
    GROUP BY s.id, s.subject_code, s.code, s.subject_name, s.name, s.credits, s.color, s.total_periods
    ORDER BY COALESCE(s.subject_name, s.name) ASC
  `;
  const result = await db.query(query, [userId]);
  return result.rows;
};

module.exports = {
  getByUserId,
  create,
  update,
  delete: deleteRecord,
  getSubjectStats
};
