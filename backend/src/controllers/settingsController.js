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
        minimum_attendance: 80,
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
  const { minimum_attendance, notifications, daily_reminders, email_timer, low_attendance_warnings } = req.body;

  try {
    // Student settings minimum attendance is locked. Retrieve existing value or default to 80.
    let finalMinAttendance = 80;
    const existingSettings = await settingsRepository.getByUserId(req.user.id);
    if (existingSettings) {
      finalMinAttendance = existingSettings.minimum_attendance;
    }

    const updatedSettings = await settingsRepository.update(req.user.id, {
      minimum_attendance: finalMinAttendance,
      theme: 'light', // Hardcoded light theme as requested
      notifications,
      daily_reminders,
      email_timer,
      low_attendance_warnings
    });

    // Log action to audit logs & send configuration email alert
    const auditLogRepository = require('../repositories/auditLogRepository');
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const alertStatus = `Min Target: ${finalMinAttendance}%, Reminders: ${notifications}, Daily: ${daily_reminders}, Timer: ${email_timer}, LowWarn: ${low_attendance_warnings}`;
    await auditLogRepository.logAction(req.user.id, 'SETTINGS_UPDATED', `Attendance Configurations updated. ${alertStatus}`, ip);

    try {
      const { sendSettingsUpdatedEmail } = require('../utils/emailHelper');
      const details = `Minimum Target Attendance: ${finalMinAttendance}%\nReminders Enabled: ${notifications}\nDaily Reminders: ${daily_reminders ? 'ON' : 'OFF'}\nEmail Timer: ${email_timer}\nLow Attendance Alarm: ${low_attendance_warnings ? 'ON' : 'OFF'}`;
      
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
