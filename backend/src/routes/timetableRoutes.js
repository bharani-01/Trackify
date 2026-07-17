const express = require('express');
const router = express.Router();
const { getTimetable, createTimetableSlot, updateTimetableSlot, deleteTimetableSlot } = require('../controllers/timetableController');
const { getStudentAdjustments } = require('../controllers/adjustmentController');
const { protect } = require('../middleware/authMiddleware');

// All timetable routes are protected
router.use(protect);

router.get('/adjustments', getStudentAdjustments);

router.route('/')
  .get(getTimetable)
  .post(createTimetableSlot);

router.route('/:id')
  .put(updateTimetableSlot)
  .delete(deleteTimetableSlot);

module.exports = router;
