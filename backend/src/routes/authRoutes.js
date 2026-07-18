const express = require('express');
const router = express.Router();
const { login, getMe, logout, forgotPassword, resetPassword, register, getRegistrationStatus, updateProfile, sendOtp, verifyOtpLogin, verifyOtpResetPassword, logError } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.get('/registration-status', getRegistrationStatus);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/log-error', logError);

// OTP authentication & password recovery routes
router.post('/otp/send', sendOtp);
router.post('/otp/login', verifyOtpLogin);
router.post('/otp/reset', verifyOtpResetPassword);

// Protected routes
router.route('/me')
  .get(protect, getMe)
  .put(protect, updateProfile);
router.post('/logout', protect, logout);

module.exports = router;
