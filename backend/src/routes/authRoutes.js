const express = require('express');
const router = express.Router();
const { login, getMe, logout, forgotPassword, resetPassword, register, getRegistrationStatus } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.get('/registration-status', getRegistrationStatus);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

module.exports = router;
