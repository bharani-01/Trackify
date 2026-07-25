const db = require('../config/db');
const auditLogRepository = require('../repositories/auditLogRepository');
const systemSettingsRepository = require('../repositories/systemSettingsRepository');

// Sleep helper to throttle email dispatches to prevent rate-limiting on Resend
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const escapeHtml = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Queue an automated daily attendance marking reminder
 */
const sendDailyMarkingReminder = async (email, name, previewOnly = false) => {
  const { queueEmail } = require('../utils/emailHelper');
  const safeName = escapeHtml(name);
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
      <h2 style="color: #2563eb; margin-bottom: 16px;">Daily Log Reminder</h2>
      <p style="color: #475569; font-size: 16px;">Hello ${safeName},</p>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">This is your scheduled daily reminder to mark your attendance logs in the Trackify student portal today.</p>
      <div style="margin: 24px 0;">
        <a href="http://localhost:3000/student/attendance" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; display: inline-block;">Mark Attendance Now</a>
      </div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">You can customize or disable these daily reminders anytime under your Student settings page.</p>
    </div>
  `;
  
  if (previewOnly) {
    return htmlContent;
  }
  await queueEmail(email, name, 'Daily Attendance Marking Reminder', htmlContent, 'reminders');
};

/**
 * Queue an automated low attendance warning alert
 */
const sendLowAttendanceWarning = async (email, name, percentage, target, userId, previewOnly = false) => {
  const { queueEmail } = require('../utils/emailHelper');
  const attendanceRepository = require('../repositories/attendanceRepository');
  const safeName = escapeHtml(name);
  const safeTarget = escapeHtml(target?.toString());

  let subjectTableHtml = '';
  try {
    const subjectStats = await attendanceRepository.getSubjectStats(userId);
    if (subjectStats && subjectStats.length > 0) {
      const rows = subjectStats.map(subj => {
        const percentageVal = subj.conducted_count > 0 
          ? Math.round(((subj.present_count + (subj.od_count || 0)) / subj.conducted_count) * 100) 
          : 100;
        const isLow = percentageVal < target;
        return `
          <tr style="border-bottom: 1px solid #edf2f7; ${isLow ? 'background-color: #fef2f2;' : ''}">
            <td style="padding: 10px; color: #1a202c; font-weight: ${isLow ? 'bold' : 'normal'};">
              ${escapeHtml(subj.subject_name || subj.name)} (${escapeHtml(subj.subject_code || subj.code)})
              ${isLow ? '<span style="color: #ef4444; font-size: 11px; margin-left: 6px; font-weight: bold;">[LOW]</span>' : ''}
            </td>
            <td style="padding: 10px; text-align: right; color: #475569;">${subj.conducted_count}</td>
            <td style="padding: 10px; text-align: right; font-weight: bold; color: ${isLow ? '#ef4444' : '#22c55e'};">
              ${percentageVal}%
            </td>
          </tr>
        `;
      }).join('');

      subjectTableHtml = `
        <h3 style="color: #475569; font-size: 15px; margin-top: 24px; margin-bottom: 12px;">Subject-wise Attendance Details</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left;">
              <th style="padding: 10px; color: #475569; font-weight: 600;">Subject</th>
              <th style="padding: 10px; color: #475569; font-weight: 600; text-align: right;">Conducted</th>
              <th style="padding: 10px; color: #475569; font-weight: 600; text-align: right;">Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    console.error('Error fetching subject stats for low attendance warning email:', err.message);
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ef4444; background-color: #ffffff;">
      <h2 style="color: #ef4444; margin-bottom: 16px;">Attendance Threshold Warning</h2>
      <p style="color: #475569; font-size: 16px;">Hello ${safeName},</p>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">Your attendance average has fallen below your configured minimum academic target percentage threshold of <strong>${safeTarget}%</strong>. Please see the subject-wise details below:</p>
      
      ${subjectTableHtml}
      
      <p style="color: #475569; font-size: 16px; line-height: 24px;">Please review your class schedules and log outstanding OD/ML records immediately to ensure compliance.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">This is an automated performance warning broadcast system. You can toggle threshold alarms in your Profile page.</p>
    </div>
  `;

  if (previewOnly) {
    return htmlContent;
  }
  await queueEmail(email, name, 'Urgent: Low Attendance Warning Alert', htmlContent, 'reminders');
};

/**
 * Process queued emails sequentially using a persistent retry queue
 */
const processEmailQueue = async () => {
  try {
    const globalEmail = await systemSettingsRepository.getSetting('global_email_notifications', 'true');
    if (globalEmail !== 'true') {
      // Bypassed if administrator disabled global email notifications
      return;
    }

    const query = `
      SELECT * FROM email_queue
      WHERE status = 'pending' 
         OR (status = 'failed' AND retry_count < 3)
      ORDER BY created_at ASC
      LIMIT 5
    `;
    const res = await db.query(query);
    if (res.rows.length === 0) return;

    console.log(`[EMAIL QUEUE WORKER]: Found ${res.rows.length} pending/failed email queue items to process...`);
    const { Resend } = require('resend');
    const resendApiKey = process.env.RESEND_API_KEY;

    for (const item of res.rows) {
      if (!resendApiKey) {
        // Simulation mode
        console.log(`[SIMULATION]: Dispatching queued email ID: ${item.id} to ${item.recipient_email}`);
        await db.query(
          "UPDATE email_queue SET status = 'sent', error_message = 'Simulated delivery (No Resend API Key)', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
          [item.id]
        );
        await sleep(1000);
        continue;
      }

      const resend = new Resend(resendApiKey);
      try {
        const category = item.category || 'auth';
        let senderEmail = await systemSettingsRepository.getSetting('mail_from_' + category);
        
        if (!senderEmail) {
          const envKey = 'MAIL_FROM_' + category.toUpperCase();
          senderEmail = process.env[envKey];
        }
        
        if (!senderEmail) {
          if (category === 'reminders') {
            senderEmail = 'Trackify Reminders <reminders@mail.trackifyapp.co.in>';
          } else if (category === 'notices') {
            senderEmail = 'Trackify Notices <notices@mail.trackifyapp.co.in>';
          } else if (category === 'backups') {
            senderEmail = 'Trackify Backups <backups@mail.trackifyapp.co.in>';
          } else {
            senderEmail = process.env.MAIL_FROM || 'Trackify Auth <auth@mail.trackifyapp.co.in>';
          }
        }

        await resend.emails.send({
          from: senderEmail,
          to: [item.recipient_email],
          subject: item.subject,
          html: item.html_content
        });

        // Set status sent
        await db.query(
          "UPDATE email_queue SET status = 'sent', error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
          [item.id]
        );
        console.log(`[EMAIL QUEUE WORKER]: Successfully dispatched queued email ID ${item.id} to ${item.recipient_email}`);
      } catch (err) {
        const newRetryCount = item.retry_count + 1;
        await db.query(
          "UPDATE email_queue SET status = 'failed', retry_count = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
          [newRetryCount, err.message, item.id]
        );
        console.error(`[EMAIL QUEUE WORKER FAILURE]: Error dispatching email ID ${item.id} (Retry #${newRetryCount}):`, err.message);
      }
      
      // Throttle to respect rate limits
      await sleep(1000);
    }
  } catch (error) {
    console.error('[EMAIL QUEUE WORKER CRITICAL EXCEPTION]:', error.message);
  }
};

/**
 * Check if a student has any unmarked scheduled class periods for today
 */
const checkUnmarkedClassesForToday = async (userId, departmentId, semester, dateStr, dayName) => {
  try {
    // 1. Check if today is an official holiday
    const holidayCheck = await db.query(
      'SELECT id FROM holidays WHERE date = $1',
      [dateStr]
    );
    if (holidayCheck.rows.length > 0) {
      return false; // Holiday - no classes to mark
    }

    // 2. Fetch base scheduled timetable slots for today
    const timetableRes = await db.query(
      'SELECT period FROM timetable WHERE department_id = $1 AND semester = $2 AND day = $3',
      [departmentId, semester, dayName]
    );

    // 3. Fetch cohort timetable adjustments for today
    const adjRes = await db.query(
      'SELECT period, adjustment_type FROM timetable_adjustments WHERE department_id = $1 AND semester = $2 AND date = $3',
      [departmentId, semester, dateStr]
    );

    const adjustments = adjRes.rows;
    let activePeriods = new Set();

    // Add base periods that are not canceled
    timetableRes.rows.forEach(slot => {
      const canceled = adjustments.some(a => a.period === slot.period && a.adjustment_type === 'cancel');
      if (!canceled) {
        activePeriods.add(slot.period);
      }
    });

    // Add extra class periods
    adjustments.forEach(adj => {
      if (adj.adjustment_type === 'extra') {
        activePeriods.add(adj.period);
      }
    });

    if (activePeriods.size === 0) {
      return false; // No scheduled active classes today
    }

    // 4. Fetch attendance logs already marked by student for today
    const logsRes = await db.query(
      'SELECT remarks FROM attendance WHERE user_id = $1 AND date = $2',
      [userId, dateStr]
    );

    const markedPeriods = new Set();
    logsRes.rows.forEach(log => {
      if (log.remarks && log.remarks.startsWith('Period ')) {
        const pNum = parseInt(log.remarks.split(' ')[1], 10);
        if (!isNaN(pNum)) {
          markedPeriods.add(pNum);
        }
      }
    });

    // 5. Return true if ANY active period remains unmarked
    for (const p of activePeriods) {
      if (!markedPeriods.has(p)) {
        return true; // Unmarked subject found!
      }
    }

    return false; // All subjects marked
  } catch (err) {
    console.error('Error checking unmarked classes for student:', err.message);
    return true; // Safety fallback
  }
};

/**
 * Run Daily Marking Reminders Sweep
 * @param {string|null} currentTimeStr - Time string formatted as 'HH:MM' (in IST) if running auto sweep. If null, triggers manually for all matches today.
 * @param {boolean} previewOnly - If true, returns draft preview objects instead of dispatching emails
 * @returns {Promise<number|Array>} - Count of reminders queued or list of preview objects
 */
const runDailyRemindersSweep = async (currentTimeStr = null, previewOnly = false) => {
  let queuedCount = 0;
  const previews = [];
  const globalEmail = await systemSettingsRepository.getSetting('global_email_notifications', 'true');
  if (globalEmail !== 'true') {
    return previewOnly ? [] : 0;
  }

  const now = new Date();
  const istDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
  const todayDateStr = istDateFormatter.format(now);

  const dayNameFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' });
  const todayDayName = dayNameFormatter.format(now);

  let query = `
    SELECT u.id, u.name, u.email, u.department_id, u.semester, s.email_timer
    FROM users u
    JOIN settings s ON u.id = s.user_id
    WHERE u.role = 'student' 
    AND s.daily_reminders = TRUE 
    AND u.is_suspended = FALSE
  `;
  const params = [];
  if (currentTimeStr) {
    query += ` AND s.email_timer = $1`;
    params.push(currentTimeStr);
  }

  const res = await db.query(query, params);
  for (const row of res.rows) {
    const hasUnmarked = await checkUnmarkedClassesForToday(row.id, row.department_id, row.semester, todayDateStr, todayDayName);
    if (hasUnmarked) {
      if (previewOnly) {
        const html = await sendDailyMarkingReminder(row.email, row.name, true);
        previews.push({
          email: row.email,
          name: row.name,
          subject: 'Daily Attendance Marking Reminder',
          html
        });
      } else {
        await sendDailyMarkingReminder(row.email, row.name);
        await auditLogRepository.logAction(
          row.id, 
          'EMAIL_DISPATCHED', 
          `Daily attendance marking reminder queued (unmarked classes found) via ${currentTimeStr ? 'auto-timer ' + currentTimeStr : 'manual admin trigger'} IST`, 
          '127.0.0.1'
        );
        queuedCount++;
      }
    }
  }
  return previewOnly ? previews : queuedCount;
};

/**
 * Run Low Attendance Warnings Sweep
 * @param {boolean} previewOnly - If true, returns draft preview objects instead of dispatching emails
 * @returns {Promise<number|Array>} - Count of warnings queued or list of preview objects
 */
const runLowAttendanceSweep = async (previewOnly = false) => {
  let queuedCount = 0;
  const previews = [];
  const globalEmail = await systemSettingsRepository.getSetting('global_email_notifications', 'true');
  if (globalEmail !== 'true') {
    return previewOnly ? [] : 0;
  }

  const lowAttendanceQuery = `
    SELECT 
      u.id, u.name, u.email,
      s.minimum_attendance,
      ROUND((SUM(CASE WHEN a.status IN ('Present', 'On Duty') THEN 1 ELSE 0 END)::float / 
        NULLIF(SUM(CASE WHEN a.status IN ('Present', 'Absent', 'On Duty') THEN 1 ELSE 0 END), 0)) * 100) AS percentage
    FROM users u
    JOIN settings s ON u.id = s.user_id
    LEFT JOIN attendance a ON u.id = a.user_id
    WHERE u.role = 'student' 
      AND s.low_attendance_warnings = TRUE
      AND u.is_suspended = FALSE
    GROUP BY u.id, u.name, u.email, s.minimum_attendance
  `;
  const res = await db.query(lowAttendanceQuery);
  for (const student of res.rows) {
    const currentPercentage = student.percentage;
    const target = student.minimum_attendance || 80;
    if (currentPercentage !== null && currentPercentage < target) {
      if (previewOnly) {
        const html = await sendLowAttendanceWarning(student.email, student.name, currentPercentage, target, student.id, true);
        previews.push({
          email: student.email,
          name: student.name,
          subject: 'Urgent: Low Attendance Warning Alert',
          html
        });
      } else {
        await sendLowAttendanceWarning(student.email, student.name, currentPercentage, target, student.id);
        await auditLogRepository.logAction(
          student.id, 
          'EMAIL_DISPATCHED', 
          `Automated low attendance warning email queued (${currentPercentage}% vs target ${target}%)`, 
          '127.0.0.1'
        );
        queuedCount++;
      }
    }
  }
  return previewOnly ? previews : queuedCount;
};

/**
 * Start the background cron reminder process
 */
const startScheduler = () => {
  console.log('[REMINDER SCHEDULER SERVICE]: Initializing background cron task daemon...');

  // 1. Run the automatic timers sweep every 60 seconds
  setInterval(async () => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      const hourPart = parts.find(p => p.type === 'hour').value;
      const minutePart = parts.find(p => p.type === 'minute').value;
      const currentHours = hourPart === '24' ? '00' : hourPart;
      const currentMinutes = minutePart;
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      // Run daily reminders for matching timers
      await runDailyRemindersSweep(currentTimeStr);

      // Run low attendance warnings at 18:00 dinner hour
      if (currentTimeStr === '18:00') {
        await runLowAttendanceSweep();
      }
    } catch (err) {
      console.error('[REMINDER SCHEDULER FATAL ERROR]: Background worker loop exception:', err.message);
    }
  }, 60000); // 60 seconds interval

  // 2. Run the email queue processor every 10 seconds to send queued emails rapidly
  setInterval(async () => {
    await processEmailQueue();
  }, 10000); // 10 seconds interval
};

module.exports = {
  startScheduler,
  runDailyRemindersSweep,
  runLowAttendanceSweep
};
