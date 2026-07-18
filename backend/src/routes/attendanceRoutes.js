const express = require('express');
const router = express.Router();
const { getAttendanceLogs, markAttendance, updateAttendance, deleteAttendance, getStats } = require('../controllers/attendanceController');
const { getStudentHolidays } = require('../controllers/holidayController');
const { protect } = require('../middleware/authMiddleware');

// All attendance routes are protected
router.use(protect);

router.route('/')
  .get(getAttendanceLogs)
  .post(markAttendance);

router.route('/stats')
  .get(getStats);

router.route('/holidays')
  .get(getStudentHolidays);

router.route('/:id')
  .put(updateAttendance)
  .delete(deleteAttendance);

module.exports = router;
