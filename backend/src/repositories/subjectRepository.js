const db = require('../config/db');

/**
 * Retrieve all department subjects for a specific student
 * @param {string} userId 
 * @returns {Promise<Array>}
 */
const getAllByUserId = async (userId) => {
  const query = `
    SELECT s.id, 
           COALESCE(s.subject_code, s.code) AS subject_code, 
           COALESCE(s.subject_name, s.name) AS subject_name, 
           s.credits, s.color, s.total_periods, s.department_id, s.semester, s.created_at
    FROM users u
    JOIN subjects s ON (s.department_id = u.department_id OR (u.department_id IS NULL AND s.department = u.department))
                    AND s.semester = u.semester
    WHERE u.id = $1
    ORDER BY COALESCE(s.subject_name, s.name) ASC
  `;
  const result = await db.query(query, [userId]);
  return result.rows;
};

/**
 * Get subject by ID for a student
 * @param {string} id 
 * @param {string} userId 
 * @returns {Promise<object|null>}
 */
const getByIdAndUser = async (id, userId) => {
  const query = `
    SELECT s.*, COALESCE(s.subject_code, s.code) AS subject_code, COALESCE(s.subject_name, s.name) AS subject_name 
    FROM subjects s
    WHERE s.id = $1
  `;
  const result = await db.query(query, [id]);
  return result.rows[0] || null;
};

/**
 * Create a new subject (Admin or custom)
 */
const create = async (subject) => {
  const { department_id, department, semester, subject_code, code, subject_name, name, credits, color, total_periods } = subject;
  const sCode = subject_code || code;
  const sName = subject_name || name;

  const query = `
    INSERT INTO subjects (department_id, department, semester, code, subject_code, name, subject_name, credits, color, total_periods)
    VALUES ($1, $2, $3, $4, $4, $5, $5, $6, $7, $8)
    RETURNING *
  `;
  const result = await db.query(query, [
    department_id || null,
    department || null,
    semester || 1,
    sCode.trim().toUpperCase(),
    sName.trim(),
    credits ? parseInt(credits, 10) : 3,
    color || '#3b82f6',
    total_periods ? parseInt(total_periods, 10) : 45
  ]);
  return result.rows[0];
};

/**
 * Update subject details
 */
const update = async (id, userId, subject) => {
  const { subject_code, subject_name, credits, color, total_periods } = subject;
  const query = `
    UPDATE subjects
    SET subject_code = $1, code = $1, subject_name = $2, name = $2, credits = $3, color = $4, total_periods = $5
    WHERE id = $6
    RETURNING *
  `;
  const result = await db.query(query, [
    subject_code.trim().toUpperCase(),
    subject_name.trim(),
    credits ? parseInt(credits, 10) : 3,
    color || '#3b82f6',
    total_periods ? parseInt(total_periods, 10) : 45,
    id
  ]);
  return result.rows[0] || null;
};

/**
 * Delete a subject
 */
const deleteSubject = async (id) => {
  const query = 'DELETE FROM subjects WHERE id = $1 RETURNING id';
  const result = await db.query(query, [id]);
  return result.rowCount > 0;
};

/**
 * Legacy compatibility stub: Master subjects are shared by department_id
 */
const copyMasterSubjects = async (client, userId, department, semester) => {
  const getMasterQuery = `
    SELECT id FROM subjects 
    WHERE (department_id = (SELECT id FROM departments WHERE UPPER(code) = UPPER($1) LIMIT 1) OR UPPER(department) = UPPER($1))
      AND semester = $2
  `;
  const masterResult = await client.query(getMasterQuery, [department, semester]);
  const map = {};
  for (const row of masterResult.rows) {
    map[row.id] = row.id;
  }
  return map;
};

module.exports = {
  getAllByUserId,
  getByIdAndUser,
  create,
  update,
  delete: deleteSubject,
  copyMasterSubjects
};
