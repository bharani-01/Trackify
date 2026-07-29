const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const { registerToken, sendCustomNotification, getVapidKey, sendTestNotification } = require('../controllers/notificationController');

const router = express.Router();

// Register client push token
router.post('/register-token', protect, registerToken);

// Get dynamic VAPID public key
router.get('/vapid-key', protect, getVapidKey);

// Send custom push notification (Admin only)
router.post('/send-custom', protect, authorize('admin'), sendCustomNotification);

// Send self test push notification (Any logged-in user)
router.post('/test-push', protect, sendTestNotification);

module.exports = router;
