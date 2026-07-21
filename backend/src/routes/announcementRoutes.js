const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Student & User Feed
router.get('/', protect, announcementController.getStudentAnnouncements);

// Admin Management
router.get('/admin/all', protect, authorize('admin'), announcementController.getAdminAnnouncements);
router.post('/admin', protect, authorize('admin'), announcementController.createAnnouncement);
router.put('/admin/:id', protect, authorize('admin'), announcementController.updateAnnouncement);
router.delete('/admin/:id', protect, authorize('admin'), announcementController.deleteAnnouncement);

module.exports = router;
