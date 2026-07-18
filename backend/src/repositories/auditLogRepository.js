const db = require('../config/db');

/**
 * Write a new audit log to the database
 * @param {string|null} userId 
 * @param {string} action 
 * @param {string} details 
 * @param {string|null} ipAddress 
 * @returns {Promise<object|null>}
 */
const logAction = async (userId, action, details, ipAddress = null) => {
  const query = `
    INSERT INTO audit_logs (user_id, action, details, ip_address)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  try {
    const result = await db.query(query, [userId, action, details, ipAddress]);
    return result.rows[0];
  } catch (error) {
    console.error('Failed to save audit log:', error.message);
    return null;
  }
};

/**
 * Retrieve paginated audit logs with search filter
 * @param {number} limit 
 * @param {number} offset 
 * @param {string} search 
 * @returns {Promise<object>} { logs, total }
 */
const getAuditLogs = async (limit, offset, search = '') => {
  let query = `
    SELECT al.*, u.name as user_name, u.register_number, u.role as user_role
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
  `;
  const params = [];

  if (search) {
    query += `
      WHERE al.action ILIKE $1 
         OR al.details ILIKE $1 
         OR u.name ILIKE $1 
         OR u.register_number ILIKE $1
    `;
    params.push(`%${search}%`);
  }

  // Fetch count
  const countQuery = `SELECT COUNT(*) FROM (${query}) AS temp`;
  const countResult = await db.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count, 10);

  // Fetch logs ordered by date
  query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  return {
    logs: result.rows,
    total
  };
};

const getClientErrors = async (limit, offset, showResolved = false) => {
  let query = `
    SELECT al.*, u.name as user_name, u.register_number, u.role as user_role
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE al.action = 'CLIENT_ERROR'
  `;
  const params = [];

  if (!showResolved) {
    query += ` AND al.resolved = false`;
  }

  // Fetch count
  const countQuery = `SELECT COUNT(*) FROM (${query}) AS temp`;
  const countResult = await db.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count, 10);

  // Fetch logs
  query += ` ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  return {
    logs: result.rows,
    total
  };
};

const resolveClientError = async (id) => {
  const query = `
    UPDATE audit_logs
    SET resolved = true
    WHERE id = $1 AND action = 'CLIENT_ERROR'
    RETURNING *
  `;
  const result = await db.query(query, [id]);
  return result.rows[0];
};

module.exports = {
  logAction,
  getAuditLogs,
  getClientErrors,
  resolveClientError
};
