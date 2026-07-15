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
  createUser
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

module.exports = router;
