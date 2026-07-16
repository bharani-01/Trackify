const db = require('../config/db');

/**
 * Log a database backup event (Success or Failed)
 */
const logBackup = async (filename, status, errorMessage = null) => {
  const query = `
    INSERT INTO backups (filename, status, error_message)
    VALUES ($1, $2, $3)
    RETURNING id, filename, status, error_message, created_at
  `;
  const result = await db.query(query, [filename, status, errorMessage]);
  return result.rows[0];
};

/**
 * Retrieve the list of past backups sorted by date
 */
const getBackupLogs = async () => {
  const query = `
    SELECT id, filename, status, COALESCE(error_message, '') AS error_message, created_at 
    FROM backups
    ORDER BY created_at DESC
    LIMIT 30
  `;
  const result = await db.query(query);
  return result.rows;
};

module.exports = {
  logBackup,
  getBackupLogs
};
