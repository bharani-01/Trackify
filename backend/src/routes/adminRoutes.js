const express = require('express');
const router = express.Router();
const { 
  getUsers, 
  toggleUserSuspension, 
  deleteUser, 
  updateStudentProfile,
  getDashboardStats, 
  getMasterSubjects, 
  createMasterSubject, 
  deleteMasterSubject, 
  getMasterTimetable, 
  createMasterTimetableSlot, 
  deleteMasterTimetableSlot,
  createUser,
  adminResetUserPassword
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All admin routes require a verified session and 'admin' role
router.use(protect);
router.use(authorize('admin'));

// Global stats
router.get('/stats', getDashboardStats);

// Student management
router.get('/users', getUsers);
router.post('/users', createUser);
router.route('/users/:id')
  .put(updateStudentProfile)
  .delete(deleteUser);
router.put('/users/:id/suspend', toggleUserSuspension);
router.put('/users/:id/reset-password', adminResetUserPassword);

// Approvals management
const { getPendingApprovals, approveRegistration, rejectRegistration } = require('../controllers/approvalController');
router.get('/approvals', getPendingApprovals);
router.put('/approvals/:id/approve', approveRegistration);
router.delete('/approvals/:id/reject', rejectRegistration);

// Global settings
const { getSettings, updateSettings } = require('../controllers/systemSettingsController');
router.route('/settings')
  .get(getSettings)
  .put(updateSettings);

// Master subjects templates
router.route('/subjects')
  .get(getMasterSubjects)
  .post(createMasterSubject);
router.route('/subjects/:id')
  .delete(deleteMasterSubject);

// Master timetable templates
router.route('/timetable')
  .get(getMasterTimetable)
  .post(createMasterTimetableSlot);
router.route('/timetable/:id')
  .delete(deleteMasterTimetableSlot);

// Backups and Data Exports management
const { getBackupsList, triggerBackup, exportData, emailData } = require('../controllers/backupController');
router.route('/backups')
  .get(getBackupsList)
  .post(triggerBackup);
router.get('/backups/export', exportData);
router.post('/backups/email', emailData);

module.exports = router;
