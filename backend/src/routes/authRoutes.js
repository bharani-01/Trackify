const express = require('express');
const router = express.Router();
const { login, googleAuth, getMe, logout, forgotPassword, resetPassword, register, getRegistrationStatus, updateProfile, sendOtp, verifyOtpLogin, verifyOtpResetPassword, logError } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authRateLimiter, otpRateLimiter } = require('../middleware/rateLimiter');

// Public routes with rate limiting protection
router.post('/register', authRateLimiter, register);
router.get('/registration-status', getRegistrationStatus);
router.post('/login', authRateLimiter, login);
router.post('/google', authRateLimiter, googleAuth);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);
router.post('/log-error', logError);

// OTP authentication & password recovery routes with strict rate limiting
router.post('/otp/send', otpRateLimiter, sendOtp);
router.post('/otp/login', otpRateLimiter, verifyOtpLogin);
router.post('/otp/reset', otpRateLimiter, verifyOtpResetPassword);

// Protected routes
router.route('/me')
  .get(protect, getMe)
  .put(protect, updateProfile);
router.post('/logout', protect, logout);

module.exports = router;
