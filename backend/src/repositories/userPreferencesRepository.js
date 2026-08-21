const db = require('../config/db');

/**
 * Get user preferences by user ID
 * @param {string} userId 
 * @returns {Promise<object>}
 */
const getByUserId = async (userId) => {
  const query = 'SELECT * FROM user_preferences WHERE user_id = $1';
  const result = await db.query(query, [userId]);
  if (result.rows.length > 0) {
    return result.rows[0];
  }
  // If not found, insert and return defaults
  return upsert(userId, { date_colors_enabled: true });
};

/**
 * Upsert user preferences
 * @param {string} userId 
 * @param {object} preferences - { date_colors_enabled }
 * @returns {Promise<object>}
 */
const upsert = async (userId, preferences = {}) => {
  const dateColorsEnabled = preferences.date_colors_enabled !== undefined ? !!preferences.date_colors_enabled : true;

  const query = `
    INSERT INTO user_preferences (user_id, date_colors_enabled, updated_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id)
    DO UPDATE SET 
      date_colors_enabled = EXCLUDED.date_colors_enabled,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  const result = await db.query(query, [userId, dateColorsEnabled]);
  return result.rows[0];
};

module.exports = {
  getByUserId,
  upsert
};
