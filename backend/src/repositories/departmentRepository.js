const db = require('../config/db');

/**
 * Get all departments
 * @returns {Promise<Array>}
 */
const getDepartments = async () => {
  const query = 'SELECT id, code, name, created_at FROM departments ORDER BY code ASC';
  const result = await db.query(query);
  return result.rows;
};

/**
 * Create a new department
 * @param {string} code
 * @param {string} name
 * @returns {Promise<Object>}
 */
const createDepartment = async (code, name) => {
  const query = 'INSERT INTO departments (code, name) VALUES ($1, $2) RETURNING id, code, name, created_at';
  const result = await db.query(query, [code.toUpperCase(), name]);
  return result.rows[0];
};

/**
 * Delete a department
 * @param {string} id
 * @returns {Promise<boolean>}
 */
const deleteDepartment = async (id) => {
  const query = 'DELETE FROM departments WHERE id = $1 RETURNING id';
  const result = await db.query(query, [id]);
  return result.rowCount > 0;
};

module.exports = {
  getDepartments,
  createDepartment,
  deleteDepartment
};
