const timetableRepository = require('../repositories/timetableRepository');

/**
 * Get all timetable slots for the logged-in student
 */
const getTimetable = async (req, res) => {
  try {
    const timetable = await timetableRepository.getByUserId(req.user.id);
    return res.status(200).json({
      success: true,
      timetable
    });
  } catch (error) {
    console.error('getTimetable controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve timetable'
    });
  }
};

/**
 * Create a new timetable slot
 */
const createTimetableSlot = async (req, res) => {
  const { subject_id, day, period, start_time, end_time, room } = req.body;

  if (!subject_id || !day || !period || !start_time || !end_time) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields (subject_id, day, period, start_time, end_time)'
    });
  }

  try {
    const newSlot = await timetableRepository.create({
      user_id: req.user.id,
      subject_id,
      day,
      period,
      start_time,
      end_time,
      room
    });

    return res.status(201).json({
      success: true,
      slot: newSlot
    });
  } catch (error) {
    console.error('createTimetableSlot controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add timetable slot'
    });
  }
};

/**
 * Update timetable slot details
 */
const updateTimetableSlot = async (req, res) => {
  const { id } = req.params;
  const { subject_id, day, period, start_time, end_time, room } = req.body;

  if (!subject_id || !day || !period || !start_time || !end_time) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields'
    });
  }

  try {
    const updatedSlot = await timetableRepository.update(id, req.user.id, {
      subject_id,
      day,
      period,
      start_time,
      end_time,
      room
    });

    if (!updatedSlot) {
      return res.status(404).json({
        success: false,
        message: 'Timetable slot not found or unauthorized'
      });
    }

    return res.status(200).json({
      success: true,
      slot: updatedSlot
    });
  } catch (error) {
    console.error('updateTimetableSlot controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update timetable slot'
    });
  }
};

/**
 * Delete a timetable slot
 */
const deleteTimetableSlot = async (req, res) => {
  const { id } = req.params;

  try {
    const isDeleted = await timetableRepository.delete(id, req.user.id);

    if (!isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Timetable slot not found or unauthorized'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Timetable slot deleted successfully'
    });
  } catch (error) {
    console.error('deleteTimetableSlot controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete timetable slot'
    });
  }
};

module.exports = {
  getTimetable,
  createTimetableSlot,
  updateTimetableSlot,
  deleteTimetableSlot
};
