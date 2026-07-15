const express = require('express');
const router = express.Router();
const { getTimetable, createTimetableSlot, updateTimetableSlot, deleteTimetableSlot } = require('../controllers/timetableController');
const { protect } = require('../middleware/authMiddleware');

// All timetable routes are protected
router.use(protect);

router.route('/')
  .get(getTimetable)
  .post(createTimetableSlot);

router.route('/:id')
  .put(updateTimetableSlot)
  .delete(deleteTimetableSlot);

module.exports = router;
