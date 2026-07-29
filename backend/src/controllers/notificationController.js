const notificationRepository = require('../repositories/notificationRepository');
const pushNotificationService = require('../services/pushNotificationService');
const auditLogRepository = require('../repositories/auditLogRepository');
const db = require('../config/db');

/**
 * Register a client device push token
 */
const registerToken = async (req, res) => {
  const { token, device_type } = req.body;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'FCM Token is required'
    });
  }

  try {
    const savedToken = await notificationRepository.saveToken(
      req.user.id,
      token,
      device_type || 'web'
    );

    return res.status(200).json({
      success: true,
      message: 'FCM Token registered successfully',
      data: savedToken
    });
  } catch (error) {
    console.error('registerToken controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register push token'
    });
  }
};

/**
 * Send a custom push notification (Admin only)
 */
const sendCustomNotification = async (req, res) => {
  const { target, targetValue, title, body, category } = req.body;

  if (!title || !body) {
    return res.status(400).json({
      success: false,
      message: 'Notification title and body are required'
    });
  }

  try {
    let userIds = [];
    let logDetail = '';

    // 1. Resolve Target Users
    if (target === 'all') {
      const usersRes = await db.query("SELECT id FROM users WHERE role = 'student'");
      userIds = usersRes.rows.map(u => u.id);
      logDetail = `Sent custom push to all students: "${title}"`;
    } else if (target === 'department') {
      if (!targetValue) {
        return res.status(400).json({ success: false, message: 'Department code is required' });
      }
      const usersRes = await db.query(
        `SELECT u.id FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE TRIM(UPPER(u.department)) = TRIM(UPPER($1)) 
            OR TRIM(UPPER(d.code)) = TRIM(UPPER($1))`,
        [targetValue]
      );
      userIds = usersRes.rows.map(u => u.id);
      logDetail = `Sent custom push to department ${targetValue}: "${title}"`;
    } else if (target === 'semester') {
      if (!targetValue) {
        return res.status(400).json({ success: false, message: 'Semester is required' });
      }
      const usersRes = await db.query("SELECT id FROM users WHERE semester = $1 AND role = 'student'", [parseInt(targetValue, 10)]);
      userIds = usersRes.rows.map(u => u.id);
      logDetail = `Sent custom push to semester ${targetValue}: "${title}"`;
    } else if (target === 'student') {
      if (!targetValue) {
        return res.status(400).json({ success: false, message: 'Student Register Number or Email is required' });
      }
      const userRes = await db.query(
        "SELECT id FROM users WHERE register_number = $1 OR email = $2",
        [targetValue.trim(), targetValue.trim().toLowerCase()]
      );
      if (userRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Student with identifier "${targetValue}" not found`
        });
      }
      userIds = [userRes.rows[0].id];
      logDetail = `Sent custom push to student ${targetValue}: "${title}"`;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid target type (must be all, department, semester, or student)'
      });
    }

    if (userIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No users found matching the specified target criteria. 0 notifications sent.',
        sentCount: 0
      });
    }

    // 2. Dispatch push notifications
    const result = await pushNotificationService.sendPush(userIds, title, body, {
      category: category || 'General',
      sentBy: req.user.name
    });

    // 3. Log Audit Action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'SEND_CUSTOM_PUSH',
      `${logDetail} (${result.successCount} delivered, ${result.failureCount} failed)`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: `Push notification dispatched successfully. Sent: ${result.successCount}, Failed: ${result.failureCount}.`,
      sentCount: result.successCount,
      failCount: result.failureCount
    });
  } catch (error) {
    console.error('sendCustomNotification controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to dispatch custom notification'
    });
  }
};

/**
 * Get public VAPID key for web push client registration
 */
const getVapidKey = async (req, res) => {
  return res.status(200).json({
    success: true,
    vapidKey: process.env.VAPID_PUBLIC_KEY || ''
  });
};

/**
 * Send a test push notification to the logged-in user
 */
const sendTestNotification = async (req, res) => {
  try {
    const result = await pushNotificationService.sendPush(
      [req.user.id],
      'Test Push Notification',
      'If you see this, your Trackify Firebase Web Push integration is working perfectly!',
      { category: 'General', sentBy: 'System Self-Test' }
    );

    return res.status(200).json({
      success: true,
      message: `Test push notification dispatched. Sent: ${result.successCount}, Failed: ${result.failureCount}.`,
      result
    });
  } catch (error) {
    console.error('sendTestNotification controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to dispatch test notification: ' + error.message
    });
  }
};

module.exports = {
  registerToken,
  sendCustomNotification,
  getVapidKey,
  sendTestNotification
};
