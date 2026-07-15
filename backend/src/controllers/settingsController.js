const settingsRepository = require('../repositories/settingsRepository');

/**
 * Get settings for the logged-in user
 */
const getSettings = async (req, res) => {
  try {
    let settings = await settingsRepository.getByUserId(req.user.id);
    
    // Create defaults if somehow not set yet
    if (!settings) {
      settings = await settingsRepository.update(req.user.id, {
        minimum_attendance: 75,
        theme: 'light',
        notifications: true
      });
    }

    return res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('getSettings controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve settings'
    });
  }
};

/**
 * Update settings configurations
 */
const updateSettings = async (req, res) => {
  const { minimum_attendance, notifications } = req.body;

  try {
    const updatedSettings = await settingsRepository.update(req.user.id, {
      minimum_attendance,
      theme: 'light', // Hardcoded light theme as requested
      notifications
    });

    return res.status(200).json({
      success: true,
      settings: updatedSettings
    });
  } catch (error) {
    console.error('updateSettings controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save settings configurations'
    });
  }
};

module.exports = {
  getSettings,
  updateSettings
};
