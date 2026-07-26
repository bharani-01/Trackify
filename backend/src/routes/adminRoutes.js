const express = require('express');
const router = express.Router();
const { 
  getUsers, 
  getAdmins,
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
  adminResetUserPassword,
  bulkUpdateSubjectHours,
  getStudentAttendanceStats,
  triggerDailyReminders,
  triggerLowAttendanceWarnings,
  previewDailyReminders,
  previewLowAttendanceWarnings,
  previewSummaryEmails,
  triggerSummaryEmails
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All admin routes require a verified session and 'admin' role
router.use(protect);
router.use(authorize('admin'));

// Global stats
router.get('/stats', getDashboardStats);

// System audit logs & client errors
const { getAuditLogs, getClientErrors, resolveClientError } = require('../controllers/auditLogController');
router.get('/audit-logs', getAuditLogs);
router.get('/client-errors', getClientErrors);
router.post('/client-errors/:id/resolve', resolveClientError);

// User & Admin management
router.get('/users', getUsers);
router.get('/administrators', getAdmins);
router.post('/users', createUser);
router.route('/users/:id')
  .put(updateStudentProfile)
  .delete(deleteUser);
router.put('/users/:id/suspend', toggleUserSuspension);
router.put('/users/:id/reset-password', adminResetUserPassword);
router.get('/users/:id/attendance-stats', getStudentAttendanceStats);

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

// Database diagnostics
const { getDatabaseDiagnostics, pingDatabase } = require('../controllers/diagnosticsController');
router.get('/diagnostics', getDatabaseDiagnostics);
router.post('/diagnostics/ping', pingDatabase);

// Manual Reminders sweep triggers
router.post('/reminders/preview-daily', previewDailyReminders);
router.post('/reminders/preview-low-attendance', previewLowAttendanceWarnings);
router.post('/reminders/trigger-daily', triggerDailyReminders);
router.post('/reminders/trigger-low-attendance', triggerLowAttendanceWarnings);
router.post('/reminders/preview-summary', previewSummaryEmails);
router.post('/reminders/trigger-summary', triggerSummaryEmails);

// Master subjects templates
router.route('/subjects')
  .get(getMasterSubjects)
  .post(createMasterSubject);
router.route('/subjects/:id')
  .delete(deleteMasterSubject);
router.post('/subjects/hours', bulkUpdateSubjectHours);

// Master timetable templates
router.route('/timetable')
  .get(getMasterTimetable)
  .post(createMasterTimetableSlot);
router.route('/timetable/:id')
  .delete(deleteMasterTimetableSlot);

// Backups and Data Exports management
const { getBackupsList, triggerBackup, exportData, emailData, getRemoteBackups, createRemoteBackup, restoreRemoteBackup, deleteRemoteBackup } = require('../controllers/backupController');
router.route('/backups')
  .get(getBackupsList)
  .post(triggerBackup);
router.get('/backups/export', exportData);
router.post('/backups/email', emailData);

// Remote database structured backup versions
router.route('/backups/remote')
  .get(getRemoteBackups)
  .post(createRemoteBackup);
router.post('/backups/remote/:id/restore', restoreRemoteBackup);
router.delete('/backups/remote/:id', deleteRemoteBackup);

// Schedule adjustments management
const { getAdminAdjustments, saveAdminAdjustments } = require('../controllers/adjustmentController');
router.route('/adjustments')
  .get(getAdminAdjustments)
  .post(saveAdminAdjustments);

// Holidays management
const { getAdminHolidays, createAdminHoliday, deleteAdminHoliday } = require('../controllers/holidayController');
router.route('/holidays')
  .get(getAdminHolidays)
  .post(createAdminHoliday);
router.route('/holidays/:id')
  .delete(deleteAdminHoliday);

// Table visualizer management
const { visualizeTable } = require('../controllers/visualizerController');
router.get('/visualize', visualizeTable);

module.exports = router;
