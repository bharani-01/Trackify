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
  const { minimum_attendance, theme, notifications, daily_reminders, email_timer, low_attendance_warnings } = settings;
  
  // Set fallback values
  const minAttendance = minimum_attendance ? parseInt(minimum_attendance, 10) : 80;
  const activeTheme = theme || 'light';
  const notifsActive = notifications !== undefined ? !!notifications : true;
  const dailyRem = daily_reminders !== undefined ? !!daily_reminders : true;
  const timerVal = email_timer || '18:00';
  const lowWarn = low_attendance_warnings !== undefined ? !!low_attendance_warnings : true;

  const query = `
    INSERT INTO settings (user_id, minimum_attendance, theme, notifications, daily_reminders, email_timer, low_attendance_warnings)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (user_id)
    DO UPDATE SET 
      minimum_attendance = EXCLUDED.minimum_attendance,
      theme = EXCLUDED.theme,
      notifications = EXCLUDED.notifications,
      daily_reminders = EXCLUDED.daily_reminders,
      email_timer = EXCLUDED.email_timer,
      low_attendance_warnings = EXCLUDED.low_attendance_warnings
    RETURNING *
  `;
  
  const result = await db.query(query, [userId, minAttendance, activeTheme, notifsActive, dailyRem, timerVal, lowWarn]);
  return result.rows[0];
};

module.exports = {
  getByUserId,
  update
};
