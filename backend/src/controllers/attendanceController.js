const attendanceRepository = require('../repositories/attendanceRepository');
const settingsRepository = require('../repositories/settingsRepository');

/**
 * Get attendance logs for the logged-in student (supports date range and subject filtering)
 */
const getAttendanceLogs = async (req, res) => {
  const { startDate, endDate, subjectId } = req.query;

  try {
    const logs = await attendanceRepository.getByUserId(req.user.id, {
      startDate,
      endDate,
      subjectId
    });

    return res.status(200).json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('getAttendanceLogs controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance logs'
    });
  }
};

/**
 * Log attendance for a subject
 */
const markAttendance = async (req, res) => {
  const { subject_id, date, status, remarks } = req.body;

  if (!subject_id || !date || !status) {
    return res.status(400).json({
      success: false,
      message: 'Please provide subject_id, date, and status'
    });
  }

  try {
    const newRecord = await attendanceRepository.create({
      user_id: req.user.id,
      subject_id,
      date,
      status,
      remarks
    });

    return res.status(201).json({
      success: true,
      record: newRecord
    });
  } catch (error) {
    console.error('markAttendance controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark attendance'
    });
  }
};

/**
 * Update a logged attendance record
 */
const updateAttendance = async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Please provide status'
    });
  }

  try {
    const updatedRecord = await attendanceRepository.update(id, req.user.id, {
      status,
      remarks
    });

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found or unauthorized'
      });
    }

    return res.status(200).json({
      success: true,
      record: updatedRecord
    });
  } catch (error) {
    console.error('updateAttendance controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update attendance'
    });
  }
};

/**
 * Delete a logged attendance record
 */
const deleteAttendance = async (req, res) => {
  const { id } = req.params;

  try {
    const isDeleted = await attendanceRepository.delete(id, req.user.id);

    if (!isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found or unauthorized'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    console.error('deleteAttendance controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete attendance record'
    });
  }
};

/**
 * Get comprehensive statistics and predictions for dashboard widgets
 */
const getStats = async (req, res) => {
  try {
    // 1. Fetch settings to get minimum attendance target
    const settings = await settingsRepository.getByUserId(req.user.id);
    const targetPercentage = settings ? settings.minimum_attendance : 80;

    // 2. Fetch subject-wise aggregated statistics
    const rawSubjectStats = await attendanceRepository.getSubjectStats(req.user.id);

    // 3. Compute overall counts
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalMedical = 0;
    let totalHoliday = 0;
    let totalConducted = 0;

    const subjectStats = rawSubjectStats.map((subj) => {
      totalPresent += subj.present_count;
      totalAbsent += subj.absent_count;
      totalMedical += subj.medical_count;
      totalHoliday += subj.holiday_count;
      totalConducted += subj.conducted_count;

      const percentage = subj.conducted_count > 0 
        ? Math.round((subj.present_count / subj.conducted_count) * 100 * 10) / 10 
        : 100.0; // Default to 100% if no classes have been conducted yet

      // Prediction for this specific subject
      let prediction = {
        status: 'Safe',
        classesNeeded: 0,
        safeAbsences: 0
      };

      if (percentage < targetPercentage) {
        // Target not met: calculate how many consecutive classes to attend to reach target
        // (Present + x) / (Conducted + x) >= Target / 100
        // (Present + x) * 100 >= Target * (Conducted + x)
        // 100 * Present + 100 * x >= Target * Conducted + Target * x
        // x * (100 - Target) >= Target * Conducted - 100 * Present
        // x = ceil( (Target * Conducted - 100 * Present) / (100 - Target) )
        const numerator = (targetPercentage * subj.conducted_count) - (100 * subj.present_count);
        const denominator = 100 - targetPercentage;
        
        prediction.status = 'Below Target';
        prediction.classesNeeded = denominator > 0 ? Math.ceil(numerator / denominator) : 0;
        if (prediction.classesNeeded < 0) prediction.classesNeeded = 0;
      } else {
        // Target met: calculate how many absences can be tolerated before dropping below target
        // Present / (Conducted + y) >= Target / 100
        // 100 * Present >= Target * Conducted + Target * y
        // y * Target <= 100 * Present - Target * Conducted
        // y = floor( (100 * Present - Target * Conducted) / Target )
        const numerator = (100 * subj.present_count) - (targetPercentage * subj.conducted_count);
        
        prediction.status = 'Above Target';
        prediction.safeAbsences = targetPercentage > 0 ? Math.floor(numerator / targetPercentage) : 0;
        if (prediction.safeAbsences < 0) prediction.safeAbsences = 0;
      }

      return {
        ...subj,
        percentage,
        prediction
      };
    });

    // 4. Compute overall percentage
    const overallPercentage = totalConducted > 0 
      ? Math.round((totalPresent / totalConducted) * 100 * 10) / 10 
      : 100.0;

    // 5. Compute overall predictions
    let overallPrediction = {
      status: 'Safe',
      classesNeeded: 0,
      safeAbsences: 0
    };

    if (overallPercentage < targetPercentage) {
      const numerator = (targetPercentage * totalConducted) - (100 * totalPresent);
      const denominator = 100 - targetPercentage;
      overallPrediction.status = 'Below Target';
      overallPrediction.classesNeeded = denominator > 0 ? Math.ceil(numerator / denominator) : 0;
    } else {
      const numerator = (100 * totalPresent) - (targetPercentage * totalConducted);
      overallPrediction.status = 'Above Target';
      overallPrediction.safeAbsences = targetPercentage > 0 ? Math.floor(numerator / targetPercentage) : 0;
    }

    return res.status(200).json({
      success: true,
      stats: {
        overallPercentage,
        totalPresent,
        totalAbsent,
        totalMedical,
        totalHoliday,
        totalConducted,
        targetPercentage,
        overallPrediction,
        subjectStats
      }
    });
  } catch (error) {
    console.error('getStats controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate attendance statistics'
    });
  }
};

module.exports = {
  getAttendanceLogs,
  markAttendance,
  updateAttendance,
  deleteAttendance,
  getStats
};
