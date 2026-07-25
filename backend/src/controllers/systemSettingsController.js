const systemSettingsRepository = require('../repositories/systemSettingsRepository');

/**
 * Retrieve current global configuration switches
 * @route GET /api/admin/settings
 */
const getSettings = async (req, res) => {
  try {
    const allowSelfReg = await systemSettingsRepository.getSetting('allow_self_registration', 'true');
    const maintMode = await systemSettingsRepository.getSetting('maintenance_mode', 'false');
    const globalEmail = await systemSettingsRepository.getSetting('global_email_notifications', 'true');
    const mailFromAuth = await systemSettingsRepository.getSetting('mail_from_auth', '');
    const mailFromReminders = await systemSettingsRepository.getSetting('mail_from_reminders', '');
    const mailFromNotices = await systemSettingsRepository.getSetting('mail_from_notices', '');
    const mailFromBackups = await systemSettingsRepository.getSetting('mail_from_backups', '');

    return res.status(200).json({
      success: true,
      settings: {
        allow_self_registration: allowSelfReg === 'true',
        maintenance_mode: maintMode === 'true',
        global_email_notifications: globalEmail === 'true',
        mail_from_auth: mailFromAuth,
        mail_from_reminders: mailFromReminders,
        mail_from_notices: mailFromNotices,
        mail_from_backups: mailFromBackups
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
  const { 
    allow_self_registration, 
    maintenance_mode, 
    global_email_notifications,
    mail_from_auth,
    mail_from_reminders,
    mail_from_notices,
    mail_from_backups
  } = req.body;

  try {
    if (allow_self_registration !== undefined) {
      await systemSettingsRepository.setSetting('allow_self_registration', allow_self_registration ? 'true' : 'false');
    }
    
    if (maintenance_mode !== undefined) {
      await systemSettingsRepository.setSetting('maintenance_mode', maintenance_mode ? 'true' : 'false');
    }

    if (global_email_notifications !== undefined) {
      await systemSettingsRepository.setSetting('global_email_notifications', global_email_notifications ? 'true' : 'false');
    }

    if (mail_from_auth !== undefined) {
      await systemSettingsRepository.setSetting('mail_from_auth', mail_from_auth);
    }

    if (mail_from_reminders !== undefined) {
      await systemSettingsRepository.setSetting('mail_from_reminders', mail_from_reminders);
    }

    if (mail_from_notices !== undefined) {
      await systemSettingsRepository.setSetting('mail_from_notices', mail_from_notices);
    }

    if (mail_from_backups !== undefined) {
      await systemSettingsRepository.setSetting('mail_from_backups', mail_from_backups);
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
