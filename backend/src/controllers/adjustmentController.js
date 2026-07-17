const adjustmentRepository = require('../repositories/adjustmentRepository');
const auditLogRepository = require('../repositories/auditLogRepository');

/**
 * Retrieve schedule adjustments for a department/semester cohort on a given date (Admin)
 */
const getAdminAdjustments = async (req, res) => {
  const { department, semester, date } = req.query;

  if (!department || !semester || !date) {
    return res.status(400).json({
      success: false,
      message: 'Please provide department, semester, and date'
    });
  }

  try {
    const adjustments = await adjustmentRepository.getByCohort(department, parseInt(semester, 10), date);
    return res.status(200).json({
      success: true,
      adjustments
    });
  } catch (error) {
    console.error('getAdminAdjustments error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve schedule adjustments'
    });
  }
};

/**
 * Create/Overwrite schedule adjustments for a cohort on a given date (Admin)
 */
const saveAdminAdjustments = async (req, res) => {
  const { department, semester, date, adjustments } = req.body;

  if (!department || !semester || !date || !Array.isArray(adjustments)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide department, semester, date, and adjustments array'
    });
  }

  try {
    await adjustmentRepository.saveCohortAdjustments(department, parseInt(semester, 10), date, adjustments);

    // Log administrative action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'SAVE_SCHEDULE_ADJUSTMENTS',
      `Saved ${adjustments.length} schedule adjustments for ${department} Semester ${semester} on ${date}`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: 'Schedule adjustments saved successfully'
    });
  } catch (error) {
    console.error('saveAdminAdjustments error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save schedule adjustments'
    });
  }
};

/**
 * Retrieve schedule adjustments for the currently logged-in student based on their profile data
 */
const getStudentAdjustments = async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({
      success: false,
      message: 'Please provide date'
    });
  }

  try {
    const department = req.user.department;
    const semester = req.user.semester;

    if (!department || !semester) {
      return res.status(200).json({
        success: true,
        adjustments: []
      });
    }

    const adjustments = await adjustmentRepository.getByCohort(department, semester, date);
    return res.status(200).json({
      success: true,
      adjustments
    });
  } catch (error) {
    console.error('getStudentAdjustments error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve schedule adjustments'
    });
  }
};

module.exports = {
  getAdminAdjustments,
  saveAdminAdjustments,
  getStudentAdjustments
};
