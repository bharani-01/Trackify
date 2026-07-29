const db = require('../config/db');

/**
 * Save or update a device push token
 * @param {string} userId 
 * @param {string} deviceToken 
 * @param {string} deviceType 
 * @returns {Promise<Object>}
 */
const saveToken = async (userId, deviceToken, deviceType = 'web') => {
  const query = `
    INSERT INTO user_device_tokens (user_id, device_token, device_type, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (device_token) 
    DO UPDATE SET user_id = EXCLUDED.user_id, device_type = EXCLUDED.device_type, updated_at = NOW()
    RETURNING *
  `;
  const result = await db.query(query, [userId, deviceToken, deviceType]);
  return result.rows[0];
};

/**
 * Retrieve active tokens for a specific user
 * @param {string} userId 
 * @returns {Promise<Array>}
 */
const getTokensByUserId = async (userId) => {
  const query = `
    SELECT device_token, device_type 
    FROM user_device_tokens 
    WHERE user_id = $1
  `;
  const result = await db.query(query, [userId]);
  return result.rows;
};

/**
 * Retrieve active tokens for users of a specific department and semester
 * @param {string} deptCode 
 * @param {number} semester 
 * @returns {Promise<Array>}
 */
const getTokensByDeptOrSem = async (deptCode, semester) => {
  const query = `
    SELECT dt.device_token, dt.device_type, u.id AS user_id
    FROM user_device_tokens dt
    JOIN users u ON dt.user_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE (TRIM(UPPER(u.department)) = TRIM(UPPER($1)) OR TRIM(UPPER(d.code)) = TRIM(UPPER($1)))
      AND u.semester = $2
  `;
  const result = await db.query(query, [deptCode, parseInt(semester, 10)]);
  return result.rows;
};

/**
 * Retrieve all registered device tokens across all users
 * @returns {Promise<Array>}
 */
const getAllTokens = async () => {
  const query = `
    SELECT device_token, device_type, user_id 
    FROM user_device_tokens
  `;
  const result = await db.query(query);
  return result.rows;
};

/**
 * Remove an invalid or expired token
 * @param {string} deviceToken 
 * @returns {Promise<boolean>}
 */
const deleteToken = async (deviceToken) => {
  const query = 'DELETE FROM user_device_tokens WHERE device_token = $1 RETURNING id';
  const result = await db.query(query, [deviceToken]);
  return result.rowCount > 0;
};

module.exports = {
  saveToken,
  getTokensByUserId,
  getTokensByDeptOrSem,
  getAllTokens,
  deleteToken
};
