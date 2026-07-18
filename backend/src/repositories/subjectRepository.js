const db = require('../config/db');

/**
 * Retrieve all subjects for a specific student
 * @param {string} userId 
 * @returns {Promise<Array>}
 */
const getAllByUserId = async (userId) => {
  const query = 'SELECT * FROM subjects WHERE user_id = $1 ORDER BY subject_name ASC';
  const result = await db.query(query, [userId]);
  return result.rows;
};

/**
 * Get subject by ID and User ID (verifying ownership)
 * @param {string} id 
 * @param {string} userId 
 * @returns {Promise<object|null>}
 */
const getByIdAndUser = async (id, userId) => {
  const query = 'SELECT * FROM subjects WHERE id = $1 AND user_id = $2';
  const result = await db.query(query, [id, userId]);
  return result.rows[0] || null;
};

/**
 * Create a new subject for a student
 * @param {object} subject - { user_id, subject_code, subject_name, credits, color }
 * @returns {Promise<object>}
 */
const create = async (subject) => {
  const { user_id, subject_code, subject_name, credits, color, total_periods } = subject;
  const query = `
    INSERT INTO subjects (user_id, subject_code, subject_name, credits, color, total_periods)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  const result = await db.query(query, [
    user_id,
    subject_code.trim().toUpperCase(),
    subject_name.trim(),
    credits ? parseInt(credits, 10) : 3,
    color || '#3b82f6',
    total_periods ? parseInt(total_periods, 10) : 45
  ]);
  return result.rows[0];
};

/**
 * Update subject details
 * @param {string} id 
 * @param {string} userId 
 * @param {object} subject - { subject_code, subject_name, credits, color }
 * @returns {Promise<object|null>}
 */
const update = async (id, userId, subject) => {
  const { subject_code, subject_name, credits, color, total_periods } = subject;
  const query = `
    UPDATE subjects
    SET subject_code = $1, subject_name = $2, credits = $3, color = $4, total_periods = $5
    WHERE id = $6 AND user_id = $7
    RETURNING *
  `;
  const result = await db.query(query, [
    subject_code.trim().toUpperCase(),
    subject_name.trim(),
    parseInt(credits, 10),
    color,
    total_periods ? parseInt(total_periods, 10) : 45,
    id,
    userId
  ]);
  return result.rows[0] || null;
};

/**
 * Delete a subject
 * @param {string} id 
 * @param {string} userId 
 * @returns {Promise<boolean>}
 */
const deleteSubject = async (id, userId) => {
  const query = 'DELETE FROM subjects WHERE id = $1 AND user_id = $2 RETURNING id';
  const result = await db.query(query, [id, userId]);
  return result.rowCount > 0;
};

/**
 * Transaction helper: Copies master subjects of department/semester for a newly registered user
 * @param {object} client - pg client transaction instance
 * @param {string} userId 
 * @param {string} department 
 * @param {number} semester 
 * @returns {Promise<object>} Map of master subject ID to new student subject ID
 */
const copyMasterSubjects = async (client, userId, department, semester) => {
  const getMasterQuery = `
    SELECT id, subject_code, subject_name, credits, color, total_periods 
    FROM subjects 
    WHERE user_id IS NULL AND department = $1 AND semester = $2
  `;
  const masterResult = await client.query(getMasterQuery, [department, semester]);
  const subjectMap = {};

  for (const masterSub of masterResult.rows) {
    const insertQuery = `
      INSERT INTO subjects (user_id, subject_code, subject_name, credits, color, total_periods)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    const result = await client.query(insertQuery, [
      userId,
      masterSub.subject_code,
      masterSub.subject_name,
      masterSub.credits,
      masterSub.color,
      masterSub.total_periods
    ]);
    // Coerce to integer to prevent prototype pollution if DB value is unexpected
    const masterSubId = parseInt(masterSub.id, 10);
    if (!Number.isFinite(masterSubId)) continue;
    subjectMap[masterSubId] = result.rows[0].id;
  }

  return subjectMap;
};

module.exports = {
  getAllByUserId,
  getByIdAndUser,
  create,
  update,
  delete: deleteSubject,
  copyMasterSubjects
};
