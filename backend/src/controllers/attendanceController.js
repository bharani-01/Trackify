const attendanceRepository = require('../repositories/attendanceRepository');
const settingsRepository = require('../repositories/settingsRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const holidayRepository = require('../repositories/holidayRepository');

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

    let holiday = null;
    if (startDate && startDate === endDate) {
      const holidays = await holidayRepository.getByDateAndTarget(startDate, req.user.department, req.user.semester);
      if (holidays.length > 0) {
        holiday = holidays[0];
      }
    }

    return res.status(200).json({
      success: true,
      logs,
      holiday
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
    // Check if the date is a holiday for this student
    const holidays = await holidayRepository.getByDateAndTarget(date, req.user.department, req.user.semester);
    if (holidays.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Attendance logging is disabled on holidays (${holidays[0].name})`
      });
    }

    const newRecord = await attendanceRepository.create({
      user_id: req.user.id,
      subject_id,
      date,
      status,
      remarks
    });

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'MARK_ATTENDANCE',
      `Marked attendance for Subject ID ${subject_id} on ${date} as ${status} (${remarks || 'no remarks'})`,
      ip
    );

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

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'UPDATE_ATTENDANCE',
      `Updated attendance record ID ${id}: set status to ${status} (${remarks || 'no remarks'})`,
      ip
    );

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

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'DELETE_ATTENDANCE',
      `Deleted attendance record ID ${id}`,
      ip
    );

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
    let totalOD = 0;
    let totalAbsent = 0;
    let totalMedical = 0;
    let totalHoliday = 0;
    let totalConducted = 0;

    const subjectStats = rawSubjectStats.map((subj) => {
      totalPresent += subj.present_count;
      totalOD += subj.od_count || 0;
      totalAbsent += subj.absent_count;
      totalMedical += subj.medical_count;
      totalHoliday += subj.holiday_count;
      totalConducted += subj.conducted_count;

      const percentage = subj.conducted_count > 0 
        ? Math.round(((subj.present_count + (subj.od_count || 0)) / subj.conducted_count) * 100 * 100) / 100 
        : 100.0; // Default to 100% if no classes have been conducted yet

      // Prediction for this specific subject
      let prediction = {
        status: 'Safe',
        classesNeeded: 0,
        safeAbsences: 0
      };

      if (percentage < targetPercentage) {
        const numerator = (targetPercentage * subj.conducted_count) - (100 * (subj.present_count + (subj.od_count || 0)));
        const denominator = 100 - targetPercentage;
        
        prediction.status = 'Below Target';
        prediction.classesNeeded = denominator > 0 ? Math.ceil(numerator / denominator) : 0;
        if (prediction.classesNeeded < 0) prediction.classesNeeded = 0;
      } else {
        const numerator = (100 * (subj.present_count + (subj.od_count || 0))) - (targetPercentage * subj.conducted_count);
        
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
      ? Math.round(((totalPresent + totalOD) / totalConducted) * 100 * 100) / 100 
      : 100.0;

    // 5. Compute overall predictions
    let overallPrediction = {
      status: 'Safe',
      classesNeeded: 0,
      safeAbsences: 0
    };

    if (overallPercentage < targetPercentage) {
      const numerator = (targetPercentage * totalConducted) - (100 * (totalPresent + totalOD));
      const denominator = 100 - targetPercentage;
      overallPrediction.status = 'Below Target';
      overallPrediction.classesNeeded = denominator > 0 ? Math.ceil(numerator / denominator) : 0;
    } else {
      const numerator = (100 * (totalPresent + totalOD)) - (targetPercentage * totalConducted);
      overallPrediction.status = 'Above Target';
      overallPrediction.safeAbsences = targetPercentage > 0 ? Math.floor(numerator / targetPercentage) : 0;
    }

    // Fetch active holiday for today matching student target scope
    const todayStr = new Date().toISOString().substring(0, 10);
    const todayHolidays = await holidayRepository.getByDateAndTarget(todayStr, req.user.department, req.user.semester);
    const todayHoliday = todayHolidays.length > 0 ? todayHolidays[0] : null;

    return res.status(200).json({
      success: true,
      stats: {
        overallPercentage,
        totalPresent,
        totalOD,
        totalAbsent,
        totalMedical,
        totalHoliday,
        totalConducted,
        targetPercentage,
        overallPrediction,
        subjectStats,
        todayHoliday
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
