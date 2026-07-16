const db = require('../config/db');

/**
 * Get the value of a system setting, returning default if not set
 */
const getSetting = async (key, defaultValue = '') => {
  try {
    const query = 'SELECT value FROM system_settings WHERE key = $1';
    const result = await db.query(query, [key]);
    if (result.rows.length > 0) {
      return result.rows[0].value;
    }
    return defaultValue;
  } catch (error) {
    console.error(`Error in getSetting for key ${key}:`, error);
    return defaultValue;
  }
};

/**
 * Set the value of a system setting (insert or update)
 */
const setSetting = async (key, value) => {
  const query = `
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (key) 
    DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    RETURNING key, value
  `;
  const result = await db.query(query, [key, String(value)]);
  return result.rows[0];
};

module.exports = {
  getSetting,
  setSetting
};
