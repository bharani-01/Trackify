const adminRepository = require('../repositories/adminRepository');
const userRepository = require('../repositories/userRepository');
const { hashPassword } = require('../utils/authHelper');
const auditLogRepository = require('../repositories/auditLogRepository');
const settingsRepository = require('../repositories/settingsRepository');
const { sendWelcomeRegistrationEmail, queueEmail } = require('../utils/emailHelper');
const subjectRepository = require('../repositories/subjectRepository');
const attendanceRepository = require('../repositories/attendanceRepository');

/**
 * Get all registered student users
 */
const getUsers = async (req, res) => {
  try {
    const users = await adminRepository.getStudents();
    return res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('getUsers controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve registered users'
    });
  }
};

/**
 * Get all administrator users
 */
const getAdmins = async (req, res) => {
  try {
    const admins = await adminRepository.getAdmins();
    return res.status(200).json({
      success: true,
      admins
    });
  } catch (error) {
    console.error('getAdmins controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve administrator accounts'
    });
  }
};

/**
 * Toggle user account suspension
 */
const toggleUserSuspension = async (req, res) => {
  const { id } = req.params;
  const { is_suspended } = req.body;

  if (is_suspended === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Please provide is_suspended value'
    });
  }

  try {
    const success = await adminRepository.setSuspension(id, !!is_suspended);
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      is_suspended ? 'SUSPEND_USER' : 'UNSUSPEND_USER',
      `Suspension status updated to ${is_suspended} for user ID ${id}`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: `User suspension status updated to ${is_suspended}`
    });
  } catch (error) {
    console.error('toggleUserSuspension controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update suspension status'
    });
  }
};

/**
 * Delete a user account completely
 */
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const success = await adminRepository.deleteUser(id);
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'DELETE_USER',
      `Deleted user account with ID ${id}`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: 'User account deleted successfully'
    });
  } catch (error) {
    console.error('deleteUser controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user account'
    });
  }
};

/**
 * Get system statistics for Admin Dashboard
 */
const getDashboardStats = async (req, res) => {
  try {
    const stats = await adminRepository.getStats();
    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('getDashboardStats controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve system statistics'
    });
  }
};

/**
 * Get master subjects templates
 */
const getMasterSubjects = async (req, res) => {
  const { department, semester } = req.query;
  const parsedSem = parseInt(semester, 10);

  if (!department || !semester || isNaN(parsedSem)) {
    return res.status(200).json({
      success: true,
      subjects: []
    });
  }

  try {
    const subjects = await adminRepository.getMasterSubjects(department, parsedSem);
    return res.status(200).json({
      success: true,
      subjects
    });
  } catch (error) {
    console.error('getMasterSubjects controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve master subjects templates'
    });
  }
};

/**
 * Add a master subject template
 */
const createMasterSubject = async (req, res) => {
  const { subject_code, subject_name, credits, color, department, semester, total_periods } = req.body;

  if (!subject_code || !subject_name || !department || !semester) {
    return res.status(400).json({
      success: false,
      message: 'Please provide subject code, name, department, and semester'
    });
  }

  try {
    const newSubject = await adminRepository.createMasterSubject({
      subject_code,
      subject_name,
      credits,
      color,
      department,
      semester,
      total_periods
    });

    return res.status(201).json({
      success: true,
      subject: newSubject
    });
  } catch (error) {
    console.error('createMasterSubject controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create master subject template'
    });
  }
};

/**
 * Remove a master subject template
 */
const deleteMasterSubject = async (req, res) => {
  const { id } = req.params;

  try {
    const success = await adminRepository.deleteMasterSubject(id);
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Master subject template not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Master subject template deleted successfully'
    });
  } catch (error) {
    console.error('deleteMasterSubject controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete master subject template'
    });
  }
};

/**
 * Get master timetable templates
 */
const getMasterTimetable = async (req, res) => {
  const { department, semester } = req.query;
  const parsedSem = parseInt(semester, 10);

  if (!department || !semester || isNaN(parsedSem)) {
    return res.status(200).json({
      success: true,
      timetable: []
    });
  }

  try {
    const timetable = await adminRepository.getMasterTimetable(department, parsedSem);
    return res.status(200).json({
      success: true,
      timetable
    });
  } catch (error) {
    console.error('getMasterTimetable controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve master timetable templates'
    });
  }
};

/**
 * Create a master timetable slot template
 */
const createMasterTimetableSlot = async (req, res) => {
  const { subject_id, day, period, start_time, end_time, room, department, semester, expires_at, send_email } = req.body;

  if (!subject_id || !day || !period || !start_time || !end_time || !department || !semester) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields'
    });
  }

  try {
    const newSlot = await adminRepository.createMasterTimetableSlot({
      subject_id,
      day,
      period,
      start_time,
      end_time,
      room,
      department,
      semester,
      expires_at: expires_at || null
    });

    // Send email notifications to target students if requested
    if (send_email === true || send_email === 'true') {
      try {
        const subject = await subjectRepository.getByIdAndUser(subject_id);
        const subjectName = subject ? subject.subject_name : 'New Class';
        const subjectCode = subject ? subject.subject_code : '';

        const students = await userRepository.findStudentsByContext({
          department,
          semester
        });

        for (const student of students) {
          const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
              <h2 style="color: #2563eb; margin-bottom: 16px;">Trackify Timetable Update: New Class Scheduled</h2>
              <p style="color: #475569; font-size: 16px; line-height: 24px;">Hello ${student.name},</p>
              <p style="color: #475569; font-size: 16px; line-height: 24px;">A new class has been scheduled for your department/semester on Trackify:</p>
              <div style="margin: 20px 0; padding: 15px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                <h3 style="margin-top: 0; color: #0f172a;">${subjectName} ${subjectCode ? `(${subjectCode})` : ''}</h3>
                <p style="color: #334155; font-size: 14px; margin-bottom: 8px;"><strong>Day:</strong> ${day}</p>
                <p style="color: #334155; font-size: 14px; margin-bottom: 8px;"><strong>Period:</strong> ${period}</p>
                <p style="color: #334155; font-size: 14px; margin-bottom: 8px;"><strong>Time:</strong> ${start_time} - ${end_time}</p>
                <p style="color: #334155; font-size: 14px; margin-bottom: 8px;"><strong>Room:</strong> ${room || 'TBA'}</p>
                ${expires_at ? `<p style="color: #ef4444; font-size: 14px; margin-bottom: 0;"><strong>Valid Until:</strong> ${new Date(expires_at).toLocaleDateString()}</p>` : ''}
              </div>
              <p style="color: #64748b; font-size: 14px;">Log in to your Trackify portal to see your updated timetable.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="color: #94a3b8; font-size: 12px;">Trackify Academic Management System</p>
            </div>
          `;
          await queueEmail(student.email, student.name, `New Class Scheduled: ${subjectName}`, htmlContent);
        }
      } catch (emailErr) {
        console.error('[TIMETABLE EMAIL WARNING]: Failed to send timetable update emails:', emailErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      slot: newSlot
    });
  } catch (error) {
    console.error('createMasterTimetableSlot controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create master timetable slot template'
    });
  }
};

/**
 * Remove a master timetable slot template
 */
const deleteMasterTimetableSlot = async (req, res) => {
  const { id } = req.params;

  try {
    const success = await adminRepository.deleteMasterTimetableSlot(id);
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Master timetable slot template not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Master timetable slot template deleted successfully'
    });
  } catch (error) {
    console.error('deleteMasterTimetableSlot controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete master timetable slot template'
    });
  }
};

/**
 * Update student profile (department and semester)
 */
const updateStudentProfile = async (req, res) => {
  const { id } = req.params;
  const { department, semester, minimum_attendance } = req.body;

  if (!department || !semester) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both department and semester'
    });
  }

  try {
    const success = await adminRepository.updateStudentProfile(id, department, parseInt(semester, 10));
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Student account not found'
      });
    }

    // Initialize subjects and timetable templates according to the new department/semester
    await adminRepository.initializeStudentSubjectsAndTimetable(id, department, parseInt(semester, 10));

    // Admin override of student minimum attendance configuration settings
    if (minimum_attendance !== undefined) {
      const existingSettings = await settingsRepository.getByUserId(id);
      await settingsRepository.update(id, {
        minimum_attendance: parseInt(minimum_attendance, 10),
        theme: existingSettings ? existingSettings.theme : 'light',
        notifications: existingSettings ? existingSettings.notifications : true,
        daily_reminders: existingSettings ? existingSettings.daily_reminders : true,
        email_timer: existingSettings ? existingSettings.email_timer : '18:00',
        low_attendance_warnings: existingSettings ? existingSettings.low_attendance_warnings : true
      });
    }

    // Log action to audit log
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'ADMIN_UPDATE_STUDENT_PROFILE',
      `Updated profile for student ID ${id}: Dept ${department}, Sem ${semester}, Min Target: ${minimum_attendance || 'unchanged'}%`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: 'Student department, semester, and attendance parameters updated successfully'
    });
  } catch (error) {
    console.error('updateStudentProfile controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update student profile and initialize schedules'
    });
  }
};

/**
 * Create a new user (student or admin) dynamically from the admin panel
 */
const createUser = async (req, res) => {
  const { name, register_number, email, password, role, department, semester } = req.body;

  try {
    // 1. Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and role'
      });
    }

    if (role === 'student' && !register_number) {
      return res.status(400).json({
        success: false,
        message: 'Registration number is required for students'
      });
    }

    // 2. Check if user already exists
    const userExists = await userRepository.findByEmail(email);
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    // 3. Hash password
    const password_hash = await hashPassword(password);

    // 4. Create user record and clone templates if student
    const newUser = await userRepository.createUser({
      name,
      register_number: role === 'student' ? register_number : `ADMIN-${Date.now().toString().slice(-4)}`,
      email,
      password_hash,
      role,
      department: role === 'student' ? department : null,
      semester: role === 'student' && semester ? parseInt(semester, 10) : null
    });

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'CREATE_USER',
      `Created new user: ${newUser.name} (${newUser.email}) as role ${newUser.role}`,
      ip
    );

    // Trigger welcome email to newly created user
    try {
      await sendWelcomeRegistrationEmail(newUser.email, newUser.name, true);
    } catch (emailErr) {
      console.error('[ADMIN CREATE USER EMAIL WARNING]: Failed to queue welcome email:', emailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Admin createUser controller error:', error);
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Registration number or email already in use'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Server error during user creation'
    });
  }
};

/**
 * Administrator override to change a user's password directly
 * @route PUT /api/admin/users/:id/reset-password
 */
const adminResetUserPassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  try {
    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update in database and wipe tokens if any
    const updatedUser = await userRepository.updatePasswordAndClearToken(id, passwordHash);
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'ADMIN_RESET_PASSWORD',
      `Overrode password for user: ${updatedUser.email} (ID ${id})`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: `Password for user ${updatedUser.email} has been overridden successfully.`
    });
  } catch (error) {
    console.error('adminResetUserPassword controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during password override'
    });
  }
};

/**
 * Update total hours for subjects in a cohort and propagate
 */
const bulkUpdateSubjectHours = async (req, res) => {
  const { department, semester, subjectHours } = req.body;

  if (!department || !semester || !Array.isArray(subjectHours)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide department, semester, and subjectHours array'
    });
  }

  try {
    // Save each subject code hours
    for (const item of subjectHours) {
      await adminRepository.updateCohortSubjectHours(
        department,
        parseInt(semester, 10),
        item.subject_code,
        parseInt(item.total_periods, 10)
      );
    }

    // Log the action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'UPDATE_COHORT_SUBJECT_HOURS',
      `Updated subject hours for cohort: Dept ${department}, Sem ${semester}. ${subjectHours.length} subjects modified.`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: 'Subject hours updated and propagated successfully'
    });
  } catch (error) {
    console.error('bulkUpdateSubjectHours controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update subject hours'
    });
  }
};

/**
 * Retrieve comprehensive subject-wise statistics for a specific student (Admin feature)
 */
const getStudentAttendanceStats = async (req, res) => {
  const { id } = req.params;
  try {
    const settings = await settingsRepository.getByUserId(id);
    const targetPercentage = settings ? settings.minimum_attendance : 80;

    const rawSubjectStats = await attendanceRepository.getSubjectStats(id);

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
        : 100.0;

      let prediction = {
        status: 'Safe',
        classesNeeded: 0,
        safeAbsences: 0
      };

      if (percentage < targetPercentage) {
        const numerator = (targetPercentage * subj.conducted_count) - (100 * (subj.present_count + (subj.od_count || 0)));
        const denominator = 100 - targetPercentage;
        prediction.status = 'Low';
        prediction.classesNeeded = denominator > 0 ? Math.ceil(numerator / denominator) : 0;
      } else {
        const numerator = (100 * (subj.present_count + (subj.od_count || 0))) - (targetPercentage * subj.conducted_count);
        prediction.status = 'Safe';
        prediction.safeAbsences = targetPercentage > 0 ? Math.floor(numerator / targetPercentage) : 0;
      }

      return {
        ...subj,
        percentage,
        prediction
      };
    });

    const overallPercentage = totalConducted > 0 
      ? Math.round(((totalPresent + totalOD) / totalConducted) * 100 * 100) / 100 
      : 100.0;

    let overallPrediction = {
      status: 'Safe',
      classesNeeded: 0,
      safeAbsences: 0
    };

    if (overallPercentage < targetPercentage) {
      const numerator = (targetPercentage * totalConducted) - (100 * (totalPresent + totalOD));
      const denominator = 100 - targetPercentage;
      overallPrediction.status = 'Low';
      overallPrediction.classesNeeded = denominator > 0 ? Math.ceil(numerator / denominator) : 0;
    } else {
      const numerator = (100 * (totalPresent + totalOD)) - (targetPercentage * totalConducted);
      overallPrediction.status = 'Safe';
      overallPrediction.safeAbsences = targetPercentage > 0 ? Math.floor(numerator / targetPercentage) : 0;
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalPresent,
        totalOD,
        totalAbsent,
        totalMedical,
        totalHoliday,
        totalConducted,
        targetPercentage,
        overallPercentage,
        overallPrediction,
        subjectStats
      }
    });
  } catch (error) {
    console.error('getStudentAttendanceStats controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve student attendance stats'
    });
  }
};

/**
 * Preview daily marking reminder emails
 * @route POST /api/admin/reminders/preview-daily
 */
const previewDailyReminders = async (req, res) => {
  try {
    const { runDailyRemindersSweep } = require('../services/reminderScheduler');
    const previews = await runDailyRemindersSweep(null, true);
    return res.status(200).json({
      success: true,
      previews
    });
  } catch (error) {
    console.error('previewDailyReminders controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate daily marking reminders previews'
    });
  }
};

/**
 * Preview low attendance warnings emails
 * @route POST /api/admin/reminders/preview-low-attendance
 */
const previewLowAttendanceWarnings = async (req, res) => {
  try {
    const { runLowAttendanceSweep } = require('../services/reminderScheduler');
    const previews = await runLowAttendanceSweep(true);
    return res.status(200).json({
      success: true,
      previews
    });
  } catch (error) {
    console.error('previewLowAttendanceWarnings controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate low attendance warning previews'
    });
  }
};

/**
 * Trigger manual daily marking reminder email sweep for students with unmarked classes today
 * @route POST /api/admin/reminders/trigger-daily
 */
const triggerDailyReminders = async (req, res) => {
  try {
    const { runDailyRemindersSweep } = require('../services/reminderScheduler');
    const queuedCount = await runDailyRemindersSweep(null); // null means manual trigger

    // Log action to audit log
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'ADMIN_TRIGGER_DAILY_REMINDERS',
      `Manually triggered daily attendance marking reminders sweep. Emails queued: ${queuedCount}`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: `Daily marking reminders sweep executed successfully. Emails queued for delivery: ${queuedCount}`,
      count: queuedCount
    });
  } catch (error) {
    console.error('triggerDailyReminders controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to trigger daily marking reminders'
    });
  }
};

/**
 * Trigger manual low attendance alerts sweep
 * @route POST /api/admin/reminders/trigger-low-attendance
 */
const triggerLowAttendanceWarnings = async (req, res) => {
  try {
    const { runLowAttendanceSweep } = require('../services/reminderScheduler');
    const queuedCount = await runLowAttendanceSweep();

    // Log action to audit log
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'ADMIN_TRIGGER_LOW_ATTENDANCE_ALERTS',
      `Manually triggered low attendance warnings sweep. Emails queued: ${queuedCount}`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: `Low attendance alerts sweep executed successfully. Emails queued for delivery: ${queuedCount}`,
      count: queuedCount
    });
  } catch (error) {
    console.error('triggerLowAttendanceWarnings controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to trigger low attendance alerts'
    });
  }
};

/**
 * Preview winking summary email template
 * @route POST /api/admin/reminders/preview-summary
 */
const previewSummaryEmails = async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Both startDate and endDate are required parameters'
      });
    }
    const { runSummaryEmailsSweep } = require('../services/reminderScheduler');
    const previews = await runSummaryEmailsSweep(startDate, endDate, true, userId || null);
    return res.status(200).json({
      success: true,
      previews
    });
  } catch (error) {
    console.error('previewSummaryEmails controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate attendance summary email previews'
    });
  }
};

/**
 * Trigger manual winking summary emails dispatch
 * @route POST /api/admin/reminders/trigger-summary
 */
const triggerSummaryEmails = async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Both startDate and endDate are required parameters'
      });
    }
    const { runSummaryEmailsSweep } = require('../services/reminderScheduler');
    const queuedCount = await runSummaryEmailsSweep(startDate, endDate, false, userId || null);

    // Log action to audit log
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'ADMIN_TRIGGER_SUMMARY_EMAILS',
      `Manually triggered winking attendance summary sweep for period ${startDate} to ${endDate}. Emails queued: ${queuedCount}${userId ? ' (Single User ID: ' + userId + ')' : ''}`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: `Manual summary sweep executed. Emails queued for delivery: ${queuedCount}`,
      count: queuedCount
    });
  } catch (error) {
    console.error('triggerSummaryEmails controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to trigger manual summary email sweep'
    });
  }
};

module.exports = {
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
};
