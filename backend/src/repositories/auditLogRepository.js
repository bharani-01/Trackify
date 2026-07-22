const db = require('../config/db');
const { parseUserAgent, getGeoLocation } = require('../utils/deviceGeoHelper');

/**
 * Write a new audit log to the database with device & geolocation tracking
 * @param {string|null} userId 
 * @param {string} action 
 * @param {string} details 
 * @param {string|null} ipAddress 
 * @param {string|null} userAgent 
 * @returns {Promise<object|null>}
 */
const logAction = async (userId, action, details, ipAddress = null, userAgent = null) => {
  try {
    const uaInfo = parseUserAgent(userAgent || '');
    const geoLocation = await getGeoLocation(ipAddress);

    const query = `
      INSERT INTO audit_logs (user_id, action, details, ip_address, device_type, is_bot, bot_name, geo_location, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await db.query(query, [
      userId,
      action,
      details,
      ipAddress,
      uaInfo.deviceType,
      uaInfo.isBot,
      uaInfo.botName,
      geoLocation,
      userAgent
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Failed to save audit log:', error.message);
    return null;
  }
};

/**
 * Retrieve paginated audit logs with search, action, device, and order filters + KPI stats
 * @param {number} limit 
 * @param {number} offset 
 * @param {string} search 
 * @param {string} actionFilter 
 * @param {string} deviceFilter 
 * @param {string} sortOrder 
 * @returns {Promise<object>} { logs, total, stats }
 */
const getAuditLogs = async (limit, offset, search = '', actionFilter = 'all', deviceFilter = 'all', sortOrder = 'DESC') => {
  let query = `
    SELECT al.*, u.name as user_name, u.register_number, u.role as user_role
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (al.action ILIKE $${params.length} OR al.details ILIKE $${params.length} OR u.name ILIKE $${params.length} OR u.register_number ILIKE $${params.length} OR al.ip_address ILIKE $${params.length} OR al.geo_location ILIKE $${params.length})`;
  }

  if (actionFilter && actionFilter !== 'all') {
    params.push(`%${actionFilter}%`);
    query += ` AND al.action ILIKE $${params.length}`;
  }

  if (deviceFilter && deviceFilter !== 'all') {
    if (deviceFilter === 'bot') {
      query += ` AND (al.is_bot = TRUE OR al.device_type = 'bot')`;
    } else {
      params.push(deviceFilter);
      query += ` AND al.device_type = $${params.length}`;
    }
  }

  // Fetch count
  const countQuery = `SELECT COUNT(*) FROM (${query}) AS temp`;
  const countResult = await db.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count, 10);

  // Fetch KPI Stats
  const statsQuery = `
    SELECT 
      COUNT(*)::int AS total,
      COUNT(CASE WHEN device_type IN ('mobile', 'tablet') THEN 1 END)::int AS mobile_count,
      COUNT(CASE WHEN is_bot = TRUE OR device_type = 'bot' THEN 1 END)::int AS bot_count,
      COUNT(CASE WHEN action ILIKE '%FAIL%' OR action ILIKE '%REJECT%' OR action ILIKE '%SUSPEND%' THEN 1 END)::int AS alert_count
    FROM audit_logs
  `;
  const statsRes = await db.query(statsQuery);
  const stats = statsRes.rows[0] || { total: 0, mobile_count: 0, bot_count: 0, alert_count: 0 };

  // Fetch logs ordered by created_at
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  query += ` ORDER BY al.created_at ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  return {
    logs: result.rows,
    total,
    stats
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
