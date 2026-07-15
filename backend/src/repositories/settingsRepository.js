const db = require('../config/db');

/**
 * Get settings for a user
 * @param {string} userId 
 * @returns {Promise<object|null>}
 */
const getByUserId = async (userId) => {
  const query = 'SELECT * FROM settings WHERE user_id = $1';
  const result = await db.query(query, [userId]);
  return result.rows[0] || null;
};

/**
 * Update settings for a user
 * @param {string} userId 
 * @param {object} settings - { minimum_attendance, theme, notifications }
 * @returns {Promise<object>}
 */
const update = async (userId, settings) => {
  const { minimum_attendance, theme, notifications } = settings;
  
  // Set fallback values
  const minAttendance = minimum_attendance ? parseInt(minimum_attendance, 10) : 75;
  const activeTheme = theme || 'light';
  const notifsActive = notifications !== undefined ? !!notifications : true;

  const query = `
    INSERT INTO settings (user_id, minimum_attendance, theme, notifications)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id)
    DO UPDATE SET 
      minimum_attendance = EXCLUDED.minimum_attendance,
      theme = EXCLUDED.theme,
      notifications = EXCLUDED.notifications
    RETURNING *
  `;
  
  const result = await db.query(query, [userId, minAttendance, activeTheme, notifsActive]);
  return result.rows[0];
};

module.exports = {
  getByUserId,
  update
};
