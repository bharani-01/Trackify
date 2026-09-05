const attendanceRepository = require('../repositories/attendanceRepository');
const settingsRepository = require('../repositories/settingsRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const holidayRepository = require('../repositories/holidayRepository');
const timetableRepository = require('../repositories/timetableRepository');
const subjectRepository = require('../repositories/subjectRepository');
const adjustmentRepository = require('../repositories/adjustmentRepository');

/**
 * Get attendance logs for the logged-in student (supports date range and subject filtering)
 */
const getAttendanceLogs = async (req, res) => {
  const { startDate, endDate, subjectId, sortBy, sortOrder } = req.query;

  try {
    let logs = await attendanceRepository.getByUserId(req.user.id, {
      startDate,
      endDate,
      subjectId,
      sortBy,
      sortOrder
    });

    let holiday = null;
    if (startDate && startDate === endDate) {
      const holidays = await holidayRepository.getByDateAndTarget(startDate, req.user.department, req.user.semester);
      if (holidays.length > 0) {
        holiday = holidays[0];
        // Automatically purge any pre-marked attendance records logged for this holiday date
        if (logs.length > 0) {
          await attendanceRepository.deleteByDate(req.user.id, startDate);
          logs = [];
        }
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
      // Purge any pre-marked attendance records for this student on this holiday date
      await attendanceRepository.deleteByDate(req.user.id, date);
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

    // Log action asynchronously without blocking response
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    auditLogRepository.logAction(
      req.user.id,
      'MARK_ATTENDANCE',
      `Marked attendance for Subject ID ${subject_id} on ${date} as ${status} (${remarks || 'no remarks'})`,
      ip
    ).catch(err => console.error('Background audit log error:', err));

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
    const existingRecord = await attendanceRepository.getById(id, req.user.id);
    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found or unauthorized'
      });
    }

    // Check if date is a holiday
    const holidays = await holidayRepository.getByDateAndTarget(existingRecord.date, req.user.department, req.user.semester);
    if (holidays.length > 0) {
      await attendanceRepository.delete(id, req.user.id);
      return res.status(400).json({
        success: false,
        message: `Attendance logging is disabled on holidays (${holidays[0].name})`
      });
    }

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

    // Log action asynchronously without blocking response
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    auditLogRepository.logAction(
      req.user.id,
      'UPDATE_ATTENDANCE',
      `Updated attendance record ID ${id}: set status to ${status} (${remarks || 'no remarks'})`,
      ip
    ).catch(err => console.error('Background audit log error:', err));

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
 * Clear all attendance records for a specific date
 */
const clearAttendanceByDate = async (req, res) => {
  const date = req.query.date || req.body.date;

  if (!date) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a date to clear attendance'
    });
  }

  try {
    const holidays = await holidayRepository.getByDateAndTarget(date, req.user.department, req.user.semester);
    if (holidays.length > 0) {
      await attendanceRepository.deleteByDate(req.user.id, date);
      return res.status(400).json({
        success: false,
        message: `Attendance logging is disabled on holidays (${holidays[0].name})`
      });
    }

    const count = await attendanceRepository.deleteByDate(req.user.id, date);

    // Log action asynchronously without blocking response
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    auditLogRepository.logAction(
      req.user.id,
      'CLEAR_ATTENDANCE',
      `Cleared all attendance records for date ${date} (${count} entries removed)`,
      ip
    ).catch(err => console.error('Background audit log error:', err));

    return res.status(200).json({
      success: true,
      message: `Cleared ${count} attendance record(s) for ${date}`,
      count
    });
  } catch (error) {
    console.error('clearAttendanceByDate controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear attendance'
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

/**
 * Get comprehensive month-level attendance calendar summary with color dot statuses
 */
const getCalendarMonthSummary = async (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || (now.getMonth() + 1); // 1-12
    const subjectId = req.query.subjectId || null;

    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Invalid month specified' });
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    // Helper for robust YYYY-MM-DD formatting without timezone shifts
    const formatToDateStr = (d) => {
      if (!d) return '';
      if (typeof d === 'string') {
        const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) return `${match[1]}-${match[2]}-${match[3]}`;
      }
      if (d instanceof Date) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      return String(d).substring(0, 10);
    };

    // 1. Fetch all attendance logs for the student in this month
    const logs = await attendanceRepository.getByUserId(req.user.id, {
      startDate,
      endDate,
      subjectId
    });

    // 2. Fetch holidays for student's department and semester
    const allHolidays = await holidayRepository.getByTarget(req.user.department, req.user.semester);
    const monthHolidays = allHolidays.filter(h => {
      const hDate = formatToDateStr(h.date);
      return hDate >= startDate && hDate <= endDate;
    });

    // 3. Fetch student's timetable slots
    const allSlots = await timetableRepository.getByUserId(req.user.id);
    const slots = subjectId ? allSlots.filter(s => String(s.subject_id) === String(subjectId)) : allSlots;

    // 4. Fetch all subjects for student dropdown filter
    const subjects = await subjectRepository.getAllByUserId(req.user.id);

    // Group logs by formatted date
    const logsByDate = {};
    logs.forEach(log => {
      const d = formatToDateStr(log.date);
      if (d) {
        if (!logsByDate[d]) logsByDate[d] = [];
        logsByDate[d].push({ ...log, date: d });
      }
    });

    // Group holidays by formatted date
    const holidaysByDate = {};
    monthHolidays.forEach(h => {
      const d = formatToDateStr(h.date);
      if (d) {
        holidaysByDate[d] = { ...h, date: d };
      }
    });

    // Group timetable slots by day of week
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const slotsByDay = {};
    dayNames.forEach(d => { slotsByDay[d] = []; });
    slots.forEach(slot => {
      if (slotsByDay[slot.day]) {
        slotsByDay[slot.day].push(slot);
      }
    });

    // Determine today string in local timezone YYYY-MM-DD
    const todayObj = new Date();
    const todayStr = formatToDateStr(todayObj);

    // Compute status and dots for each day of the month
    const days = {};
    let totalPresentDays = 0;
    let totalAbsentDays = 0;
    let totalPendingDays = 0;
    let totalMedicalDays = 0;
    let totalOdDays = 0;
    let totalHolidays = 0;
    let totalConductedPeriods = 0;
    let totalAttendedPeriods = 0;

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayDate = new Date(year, month - 1, dayNum);
      const dayOfWeek = dayNames[dayDate.getDay()];

      const holiday = holidaysByDate[dateStr] || null;
      const daySlots = slotsByDay[dayOfWeek] || [];
      const dayLogs = logsByDate[dateStr] || [];

      let status = 'off_day';
      let dots = []; // Array of colors: 'green', 'yellow', 'red', 'blue', 'purple', 'orange'
      let statusLabel = 'No Classes';

      if (holiday) {
        status = 'holiday';
        statusLabel = `Holiday: ${holiday.name}`;
        dots = ['blue'];
        totalHolidays++;
      } else if (daySlots.length === 0 && dayLogs.length === 0) {
        status = 'off_day';
        statusLabel = (dayOfWeek === 'Sunday' || dayOfWeek === 'Saturday') ? 'Weekend' : 'No Scheduled Classes';
        dots = [];
      } else {
        const scheduledCount = daySlots.length;
        const markedCount = dayLogs.length;

        const presentCount = dayLogs.filter(l => l.status === 'Present').length;
        const absentCount = dayLogs.filter(l => l.status === 'Absent').length;
        const odCount = dayLogs.filter(l => l.status === 'On Duty').length;
        const medicalCount = dayLogs.filter(l => l.status === 'Medical Leave').length;

        const dotsSet = new Set();

        if (dateStr > todayStr) {
          // Future date
          status = 'upcoming';
          statusLabel = `${scheduledCount} Class${scheduledCount > 1 ? 'es' : ''} Scheduled`;
          dots = ['future'];
        } else if (dateStr === todayStr) {
          // Today
          if (markedCount === 0) {
            status = 'pending';
            statusLabel = 'Pending Marking';
            dots = ['yellow'];
            totalPendingDays++;
          } else {
            if (presentCount > 0) dotsSet.add('green');
            if (odCount > 0) dotsSet.add('purple');
            if (medicalCount > 0) dotsSet.add('orange');
            if (absentCount > 0) dotsSet.add('red');

            if (markedCount < scheduledCount) {
              status = 'partial';
              statusLabel = `${markedCount}/${scheduledCount} Marked (Pending)`;
              dotsSet.add('yellow');
              totalPendingDays++;
            } else {
              // All scheduled classes marked today
              if (medicalCount === markedCount) {
                status = 'medical';
                statusLabel = 'Medical Leave (ML)';
                totalMedicalDays++;
              } else if (odCount === markedCount) {
                status = 'od';
                statusLabel = 'On Duty (OD)';
                totalOdDays++;
                totalPresentDays++;
              } else if (absentCount === markedCount) {
                status = 'absent';
                statusLabel = 'All Absent';
                totalAbsentDays++;
              } else if (presentCount === markedCount) {
                status = 'present';
                statusLabel = 'All Marked Present';
                totalPresentDays++;
              } else {
                status = 'mixed';
                const parts = [];
                if (presentCount > 0) parts.push(`${presentCount} Present`);
                if (odCount > 0) parts.push(`${odCount} OD`);
                if (medicalCount > 0) parts.push(`${medicalCount} ML`);
                if (absentCount > 0) parts.push(`${absentCount} Absent`);
                statusLabel = parts.join(', ');
                if (presentCount + odCount + medicalCount >= absentCount) totalPresentDays++; else totalAbsentDays++;
              }
            }
            dots = Array.from(dotsSet);
          }
          totalConductedPeriods += markedCount;
          totalAttendedPeriods += (presentCount + odCount);
        } else {
          // Past date (< todayStr)
          if (markedCount === 0) {
            status = 'not_marked';
            statusLabel = 'Not Marked / Missed';
            dots = ['red'];
            totalAbsentDays++;
            totalConductedPeriods += scheduledCount;
          } else {
            if (presentCount > 0) dotsSet.add('green');
            if (odCount > 0) dotsSet.add('purple');
            if (medicalCount > 0) dotsSet.add('orange');
            if (absentCount > 0) dotsSet.add('red');

            if (markedCount < scheduledCount) {
              status = 'partial_missed';
              statusLabel = `${markedCount}/${scheduledCount} Marked (${scheduledCount - markedCount} Missed)`;
              dotsSet.add('red');
              totalAbsentDays++;
              totalConductedPeriods += scheduledCount;
              totalAttendedPeriods += (presentCount + odCount);
            } else {
              if (medicalCount === markedCount) {
                status = 'medical';
                statusLabel = 'Medical Leave (ML)';
                totalMedicalDays++;
              } else if (odCount === markedCount) {
                status = 'od';
                statusLabel = 'On Duty (OD)';
                totalOdDays++;
                totalPresentDays++;
              } else if (absentCount === markedCount) {
                status = 'absent';
                statusLabel = 'All Absent';
                totalAbsentDays++;
              } else if (presentCount === markedCount) {
                status = 'present';
                statusLabel = 'Marked Present';
                totalPresentDays++;
              } else {
                status = 'mixed';
                const parts = [];
                if (presentCount > 0) parts.push(`${presentCount} Present`);
                if (odCount > 0) parts.push(`${odCount} OD`);
                if (medicalCount > 0) parts.push(`${medicalCount} ML`);
                if (absentCount > 0) parts.push(`${absentCount} Absent`);
                statusLabel = parts.join(', ');
                if (presentCount + odCount + medicalCount >= absentCount) totalPresentDays++; else totalAbsentDays++;
              }
              totalConductedPeriods += markedCount;
              totalAttendedPeriods += (presentCount + odCount);
            }
            dots = Array.from(dotsSet);
          }
        }
      }

      days[dateStr] = {
        date: dateStr,
        dayNum,
        dayOfWeek,
        isToday: dateStr === todayStr,
        isFuture: dateStr > todayStr,
        isPast: dateStr < todayStr,
        status,
        statusLabel,
        dots,
        holiday,
        scheduledSlots: daySlots,
        logs: dayLogs
      };
    }

    const monthlyPercentage = totalConductedPeriods > 0
      ? Math.round((totalAttendedPeriods / totalConductedPeriods) * 100 * 10) / 10
      : 100.0;

    return res.status(200).json({
      success: true,
      year,
      month,
      daysInMonth,
      startDate,
      endDate,
      today: todayStr,
      summary: {
        totalPresentDays,
        totalAbsentDays,
        totalPendingDays,
        totalMedicalDays,
        totalOdDays,
        totalHolidays,
        totalConductedPeriods,
        totalAttendedPeriods,
        monthlyPercentage
      },
      subjects,
      days
    });
  } catch (error) {
    console.error('getCalendarMonthSummary controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve calendar month summary'
    });
  }
};

module.exports = {
  getAttendanceLogs,
  markAttendance,
  updateAttendance,
  deleteAttendance,
  clearAttendanceByDate,
  getStats,
  getCalendarMonthSummary
};
