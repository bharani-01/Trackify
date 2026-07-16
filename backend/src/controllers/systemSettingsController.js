const systemSettingsRepository = require('../repositories/systemSettingsRepository');

/**
 * Retrieve current global configuration switches
 * @route GET /api/admin/settings
 */
const getSettings = async (req, res) => {
  try {
    const allowSelfReg = await systemSettingsRepository.getSetting('allow_self_registration', 'true');
    const maintMode = await systemSettingsRepository.getSetting('maintenance_mode', 'false');

    return res.status(200).json({
      success: true,
      settings: {
        allow_self_registration: allowSelfReg === 'true',
        maintenance_mode: maintMode === 'true'
      }
    });
  } catch (error) {
    console.error('getSettings controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving system settings'
    });
  }
};

/**
 * Update global configuration switches
 * @route PUT /api/admin/settings
 */
const updateSettings = async (req, res) => {
  const { allow_self_registration, maintenance_mode } = req.body;

  try {
    if (allow_self_registration !== undefined) {
      await systemSettingsRepository.setSetting('allow_self_registration', allow_self_registration ? 'true' : 'false');
    }
    
    if (maintenance_mode !== undefined) {
      await systemSettingsRepository.setSetting('maintenance_mode', maintenance_mode ? 'true' : 'false');
    }

    return res.status(200).json({
      success: true,
      message: 'System settings updated successfully.'
    });
  } catch (error) {
    console.error('updateSettings controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating system settings'
    });
  }
};

module.exports = {
  getSettings,
  updateSettings
};
