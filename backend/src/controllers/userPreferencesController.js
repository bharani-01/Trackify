const userPreferencesRepository = require('../repositories/userPreferencesRepository');

/**
 * Get preferences for the logged-in user
 */
const getPreferences = async (req, res) => {
  try {
    const preferences = await userPreferencesRepository.getByUserId(req.user.id);
    return res.status(200).json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('getPreferences controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user preferences'
    });
  }
};

/**
 * Update preferences for the logged-in user
 */
const updatePreferences = async (req, res) => {
  const { date_colors_enabled } = req.body;

  try {
    const updatedPreferences = await userPreferencesRepository.upsert(req.user.id, {
      date_colors_enabled
    });

    return res.status(200).json({
      success: true,
      preferences: updatedPreferences
    });
  } catch (error) {
    console.error('updatePreferences controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user preferences'
    });
  }
};

module.exports = {
  getPreferences,
  updatePreferences
};
