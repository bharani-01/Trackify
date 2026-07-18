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

    // Log action to audit logs & send configuration email alert
    const auditLogRepository = require('../repositories/auditLogRepository');
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(req.user.id, 'SETTINGS_UPDATED', `Attendance Configurations updated. Min Target: ${minimum_attendance}%, Reminders: ${notifications}`, ip);

    try {
      const { sendSettingsUpdatedEmail } = require('../utils/emailHelper');
      const details = `Minimum Target Attendance: ${minimum_attendance}%\nReminders Enabled: ${notifications}`;
      
      await sendSettingsUpdatedEmail(req.user.email, req.user.name, details);
      await auditLogRepository.logAction(req.user.id, 'EMAIL_DISPATCHED', `Settings update notification email sent to ${req.user.email}`, ip);
    } catch (emailErr) {
      console.error('Non-blocking error dispatching settings update email alert:', emailErr.message);
    }

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
