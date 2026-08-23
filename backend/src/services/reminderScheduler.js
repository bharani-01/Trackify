const db = require('../config/db');
const auditLogRepository = require('../repositories/auditLogRepository');
const systemSettingsRepository = require('../repositories/systemSettingsRepository');
const pushNotificationService = require('./pushNotificationService');

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
        <a href="${process.env.APP_URL || 'https://app.trackifyapp.co.in'}/student/attendance" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; display: inline-block;">Mark Attendance Now</a>
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
let isProcessingQueue = false;

/**
 * Process queued emails sequentially using a persistent retry queue
 */
const processEmailQueue = async () => {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    const globalEmail = await systemSettingsRepository.getSetting('global_email_notifications', 'true');
    if (globalEmail !== 'true') {
      // Bypassed if administrator disabled global email notifications
      return;
    }

    // Atomically select and mark selected items as 'processing' using SKIP LOCKED to prevent duplicate picking across workers/instances
    const updateQuery = `
      UPDATE email_queue
      SET status = 'processing', updated_at = CURRENT_TIMESTAMP
      WHERE id IN (
        SELECT id FROM email_queue
        WHERE status = 'pending' 
           OR (status = 'failed' AND retry_count < 3)
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 5
      )
      RETURNING *
    `;
    const res = await db.query(updateQuery);
    if (res.rows.length === 0) return;

    console.log(`[EMAIL QUEUE WORKER]: Claimed ${res.rows.length} pending/failed email queue items for processing...`);
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
  } finally {
    isProcessingQueue = false;
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
      `SELECT t.period FROM timetable t
       LEFT JOIN departments d ON (t.department_id = d.id OR UPPER(t.department) = UPPER(d.code))
       WHERE (t.department_id = $1 OR d.id = $1 OR UPPER(t.department) = (SELECT UPPER(code) FROM departments WHERE id = $1 LIMIT 1))
         AND t.semester = $2 AND LOWER(t.day) = LOWER($3)`,
      [departmentId, semester, dayName]
    );

    // 3. Fetch cohort timetable adjustments for today
    const adjRes = await db.query(
      `SELECT period, adjustment_type FROM timetable_adjustments 
       WHERE department_id = $1 AND semester = $2 AND date = $3`,
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
    // Check if daily reminder was ALREADY queued/sent for this user today
    if (!previewOnly) {
      const alreadySentCheck = await db.query(
        `SELECT id FROM email_queue 
         WHERE recipient_email = $1 
           AND category = 'reminders' 
           AND subject = 'Daily Attendance Marking Reminder'
           AND created_at >= CURRENT_DATE`,
        [row.email.toLowerCase().trim()]
      );
      if (alreadySentCheck.rows.length > 0) {
        continue;
      }
    }

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
        await pushNotificationService.sendPush(
          [row.id],
          'Daily Attendance Reminder',
          `Hello ${row.name}, this is a reminder to log your attendance in Trackify today.`,
          { category: 'Reminder' }
        );
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
        // Check if low attendance warning was ALREADY queued/sent for this user today
        const warningCheck = await db.query(
          `SELECT id FROM email_queue 
           WHERE recipient_email = $1 
             AND category = 'reminders' 
             AND subject = 'Urgent: Low Attendance Warning Alert'
             AND created_at >= CURRENT_DATE`,
          [student.email.toLowerCase().trim()]
        );
        if (warningCheck.rows.length > 0) {
          continue;
        }

        await sendLowAttendanceWarning(student.email, student.name, currentPercentage, target, student.id);
        await pushNotificationService.sendPush(
          [student.id],
          'Urgent: Low Attendance Alert',
          `Your average attendance has dropped to ${currentPercentage}% (minimum target is ${target}%).`,
          { category: 'Warning' }
        );
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
 * Get subject-wise attendance aggregation statistics for a student in a date range
 */
const getSubjectStatsBetweenDates = async (userId, startDate, endDate) => {
  const query = `
    SELECT 
      s.id AS subject_id,
      COALESCE(s.subject_code, s.code) AS subject_code,
      COALESCE(s.subject_name, s.name) AS subject_name,
      COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0)::int AS present_count,
      COALESCE(SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END), 0)::int AS absent_count,
      COALESCE(SUM(CASE WHEN a.status = 'Medical Leave' THEN 1 ELSE 0 END), 0)::int AS medical_count,
      COALESCE(SUM(CASE WHEN a.status = 'Holiday' THEN 1 ELSE 0 END), 0)::int AS holiday_count,
      COALESCE(SUM(CASE WHEN a.status = 'On Duty' THEN 1 ELSE 0 END), 0)::int AS od_count,
      COALESCE(SUM(CASE WHEN a.status IN ('Present', 'Absent', 'On Duty') THEN 1 ELSE 0 END), 0)::int AS conducted_count
    FROM users u
    JOIN (
      SELECT DISTINCT ON (COALESCE(department_id::text, UPPER(TRIM(department))), semester, UPPER(COALESCE(subject_code, code)))
             id, department_id, department, semester, subject_code, code, subject_name, name
      FROM subjects
      WHERE user_id IS NULL
      ORDER BY COALESCE(department_id::text, UPPER(TRIM(department))), semester, UPPER(COALESCE(subject_code, code)), created_at ASC, id ASC
    ) s ON (s.department_id = u.department_id OR (u.department_id IS NULL AND UPPER(TRIM(s.department)) = UPPER(TRIM(u.department))))
        AND s.semester = u.semester
    LEFT JOIN attendance a ON s.id = a.subject_id AND a.user_id = u.id AND a.date >= $2 AND a.date <= $3
    WHERE u.id = $1
    GROUP BY s.id, s.subject_code, s.code, s.subject_name, s.name
    ORDER BY COALESCE(s.subject_name, s.name) ASC
  `;
  const result = await db.query(query, [userId, startDate, endDate]);
  return result.rows;
};

/**
 * Compile and queue/preview a 15-day attendance summary email using the winking-envelope HTML template
 */
const send15DayAttendanceSummary = async (userId, startDate, endDate, previewOnly = false) => {
  const userRepository = require('../repositories/userRepository');
  const student = await userRepository.findById(userId);
  if (!student) throw new Error('Student not found');

  const stats = await getSubjectStatsBetweenDates(userId, startDate, endDate);

  const sentAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

  let rowsHtml = '';
  stats.forEach(subj => {
    const totalPeriods = subj.conducted_count;
    const present = subj.present_count;
    const absent = subj.absent_count;
    const od = subj.od_count;
    const percentageVal = totalPeriods > 0 
      ? Math.round(((present + od) / totalPeriods) * 100) 
      : 100;
    const isLow = percentageVal < 80;
    const rowBg = isLow ? 'background-color:#FEF2F2;' : 'background-color:#ffffff;';
    const borderColor = isLow ? '#FECACA' : '#F3F4F6';
    const tdBase = `padding:12px 8px; border-bottom:1px solid ${borderColor}; font-size:12px; font-family:'Inter',sans-serif; color:#111827;`;

    rowsHtml += `
      <tr style="${rowBg}">
        <td class="att-table-td" style="${tdBase} font-weight:600;">
          ${isLow ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#DC2626;margin-right:6px;vertical-align:middle;"></span>' : ''}
          ${escapeHtml(subj.subject_name || subj.name)}
        </td>
        <td class="att-table-td" style="${tdBase} text-align:center;">${totalPeriods}</td>
        <td class="att-table-td" style="${tdBase} text-align:center;">${present}</td>
        <td class="att-table-td" style="${tdBase} text-align:center;">${absent}</td>
        <td class="att-table-td" style="${tdBase} text-align:center;">${od}</td>
        <td class="att-table-td" style="${tdBase} text-align:center;">
          <span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;${isLow ? 'background:#FEE2E2;color:#B91C1C;' : 'background:#ECFDF5;color:#059669;'}">${percentageVal}%</span>
        </td>
      </tr>
    `;
  });


  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>Trackify Attendance Report</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Inter:wght@400;500;600;800&display=swap" rel="stylesheet">
    <style>
        :root {
            color-scheme: light dark;
            supported-color-schemes: light dark;
        }

        body, html {
            margin: 0; padding: 0;
            background: linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 50%, #F8FAFC 100%);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            -webkit-font-smoothing: antialiased;
        }
        * { box-sizing: border-box; }

        .email-wrapper {
            max-width: 620px;
            margin: 0 auto;
            padding: 32px 20px 28px;
        }

        /* Default Header styling: Dark Theme (Half-dark split) */
        .header-card {
            background: #111827;
            border-radius: 20px 20px 0 0;
            padding: 32px 28px 24px;
            text-align: center;
        }
        .eyebrow {
            display: inline-block;
            background: rgba(255,255,255,0.15);
            color: #ffffff;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            border-radius: 999px;
            padding: 5px 14px;
            margin-bottom: 14px;
        }
        .title {
            font-size: 30px;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: -1px;
            margin: 0 0 8px;
            line-height: 1.1;
        }
        .subtitle {
            font-size: 14px;
            color: rgba(255,255,255,0.6);
            margin: 0;
            line-height: 1.5;
        }

        /* Default (Light) Main report card */
        .report-card-cell {
            background: #FFFFFF;
            border: 1px solid #E5E7EB;
            border-top: none;
            border-radius: 0 0 20px 20px;
            padding: 28px 28px 24px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.06);
        }

        .period-badge {
            display: inline-block;
            background: #F3F4F6;
            color: #374151;
            font-size: 11px;
            font-weight: 700;
            padding: 5px 12px;
            border-radius: 999px;
            letter-spacing: 0.3px;
            margin-bottom: 18px;
        }

        .student-name-text {
            font-size: 22px;
            font-weight: 800;
            color: #111827;
            letter-spacing: -0.5px;
            margin: 0 0 4px;
        }
        .report-label-text {
            font-size: 13px;
            color: #6B7280;
            margin: 0 0 20px;
        }

        .alert-badge {
            display: inline-block;
            background: #EEF2FF;
            color: #4338CA;
            font-size: 11px;
            font-weight: 700;
            padding: 6px 14px;
            border-radius: 999px;
            margin-bottom: 18px;
        }

        /* All rendering handled via inline styles for Gmail compatibility */

        @media only screen and (max-width: 480px) {
            .email-wrapper { padding: 18px 12px 22px; }
            .header-card { padding: 24px 18px 20px; border-radius: 16px 16px 0 0; }
            .title { font-size: 24px; }
            .report-card-cell { padding: 20px 16px 18px; border-radius: 0 0 16px 16px; }
        }

        /* Dark Mode Overrides */
        @media (prefers-color-scheme: dark) {
            body {
                background: #0f172a !important;
            }
            .email-wrapper {
                background: #0f172a !important;
            }
            .header-card {
                background: #111827 !important;
                border-color: #1f2937 !important;
            }
            .eyebrow {
                background: rgba(255,255,255,0.15) !important;
                color: #ffffff !important;
            }
            .title {
                color: #ffffff !important;
            }
            .subtitle {
                color: rgba(255,255,255,0.6) !important;
            }
            .logo-light {
                display: inline-block !important;
            }
            .logo-dark {
                display: none !important;
            }
            .report-card-cell {
                background: #1e293b !important;
                border-color: #334155 !important;
            }
            .student-name-text {
                color: #ffffff !important;
            }
            .report-label-text {
                color: #94a3b8 !important;
            }
            .att-table-th {
                color: #64748b !important;
                border-bottom-color: #334155 !important;
            }
            .att-table-td {
                color: #e2e8f0 !important;
                border-bottom-color: #334155 !important;
            }
            .footer-note-text {
                color: #94a3b8 !important;
            }
            .email-footer-cell {
                color: #64748b !important;
            }
            .email-footer-link {
                color: #e2e8f0 !important;
            }
            .email-footer-sig {
                color: #94a3b8 !important;
            }
        }
    </style>
</head>
<body>
<div class="email-wrapper">

    <!-- Header -->
    <div class="header-card">
        <div style="margin-bottom: 12px; text-align: center;">
            <!-- Light Theme Logo (shown in light mode on dark bg by default) -->
            <img class="logo-light" src="https://app.trackifyapp.co.in/assets/images/logo_light.webp" alt="Trackify" width="130" height="auto" style="display:inline-block; width:130px; height:auto; border:0; outline:none; text-decoration:none; margin: 0 auto; color: #ffffff; font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
            <!-- Dark Theme Logo (hidden in light mode, shown as fallback if inverted) -->
            <!--[if !mso]><!-->
            <img class="logo-dark" src="https://app.trackifyapp.co.in/assets/images/logo_dark.webp" alt="Trackify" width="130" height="auto" style="display:none; width:130px; height:auto; border:0; outline:none; text-decoration:none; margin: 0 auto; color: #111827; font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
            <!--<![endif]-->
        </div>
        <div class="eyebrow">Trackify Update</div>
        <h1 class="title">Attendance Report</h1>
        <p class="subtitle">Here is a quick snapshot of your attendance for the reported period.</p>
    </div>

    <!-- Envelope card -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
      <tr>
        <td style="padding: 0; background: #1a2235;">

          <!-- Top flap: diagonal lines mimicking envelope V -->  
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
            <tr>
              <td width="50%" style="height: 38px; border-right: 1px solid rgba(255,255,255,0.08); background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);"></td>
              <td width="50%" style="height: 38px; background: linear-gradient(225deg, #0f172a 0%, #1e293b 100%);"></td>
            </tr>
          </table>

          <!-- Envelope body: FROM label + address + center logo seal + TO address -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse; border-top: 1px solid rgba(255,255,255,0.08);">
            <tr>
              <!-- Left: FROM address -->
              <td style="padding: 18px 16px 20px 20px; vertical-align: top; width: 34%;">
                <div style="font-family: 'Caveat', cursive; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.4); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px;">FROM</div>
                <div style="font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.55); line-height: 1.5;">Trackify System<br>attendance@mail.trackifyapp.co.in</div>
              </td>

              <!-- Center: Trackify Favicon Seal -->
              <td style="width: 26%; text-align: center; vertical-align: middle; padding: 14px 0;">
                <div style="display: inline-block; width: 54px; height: 54px; border-radius: 50%; background: #0f172a; border: 2px solid #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.25), 0 8px 20px rgba(0,0,0,0.5); text-align: center; vertical-align: middle; overflow: hidden;">
                  <img src="https://app.trackifyapp.co.in/assets/images/favicon.webp" alt="T" width="34" height="34" style="display:inline-block; width:34px; height:34px; border:0; outline:none; border-radius:50%; margin-top: 9px; color: #ffffff; font-family: 'Inter', sans-serif; font-size: 20px; font-weight: 800; line-height: 34px;">
                </div>
              </td>

              <!-- Right: TO address + Postage Stamp -->
              <td style="padding: 18px 20px 20px 16px; vertical-align: top; text-align: right; width: 40%;">
                <!-- Sleek Postage stamp -->
                <table cellpadding="0" cellspacing="0" role="presentation" align="right" style="border-collapse:collapse; margin-bottom: 8px;">
                  <tr>
                    <td style="padding: 4px 8px; background: rgba(99, 102, 241, 0.15); border-radius: 4px; border: 1.5px dashed rgba(165, 180, 252, 0.5);">
                      <div style="font-family: 'Inter', sans-serif; font-size: 8px; font-weight: 800; color: #a5b4fc; letter-spacing: 1px; text-transform: uppercase;">POSTAGE PAID &bull; 2026</div>
                    </td>
                  </tr>
                </table>
                <div style="clear: both;"></div>
                <!-- TO address -->
                <div style="font-family: 'Caveat', cursive; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.4); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px;">TO</div>
                <div style="font-family: 'Caveat', cursive; font-size: 22px; font-weight: 600; color: #fff; line-height: 1.2;">${escapeHtml(student.name)}</div>
              </td>
            </tr>
          </table>

          <!-- Bottom border decoration: red + blue postal stripes -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
            <tr>
              <td style="height: 5px; background: #DC2626;"></td>
              <td style="height: 5px; background: #1D4ED8;"></td>
              <td style="height: 5px; background: #DC2626;"></td>
              <td style="height: 5px; background: #1D4ED8;"></td>
              <td style="height: 5px; background: #DC2626;"></td>
              <td style="height: 5px; background: #1D4ED8;"></td>
            </tr>
          </table>

        </td>
      </tr>
    </table>

    <!-- Report card: 100% inline-styled table layout for Gmail -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
      <tr>
        <td class="report-card-cell" style="background:#ffffff; border:1px solid #E5E7EB; border-top:none; border-radius:0 0 20px 20px; padding:28px 28px 24px; font-family:'Inter',sans-serif;">

          <!-- Period badge -->
          <table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse; margin-bottom:18px;">
            <tr>
              <td style="background:#F3F4F6; color:#374151; font-size:11px; font-weight:700; padding:5px 12px; border-radius:999px; font-family:'Inter',sans-serif; letter-spacing:0.3px;">📅 ${startDate} &nbsp;&rarr;&nbsp; ${endDate}</td>
            </tr>
          </table>

          <!-- Student name -->
          <div class="student-name-text" style="font-size:22px; font-weight:800; color:#111827; letter-spacing:-0.5px; margin:0 0 4px; font-family:'Inter',sans-serif;">${escapeHtml(student.name)}</div>
          <div class="report-label-text" style="font-size:13px; color:#6B7280; margin:0 0 20px; font-family:'Inter',sans-serif;">Subject-wise attendance summary &bull; Generated: ${sentAt}</div>

          <!-- Warning badge -->
          <table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse; margin-bottom:20px;">
            <tr>
              <td style="background:#EEF2FF; color:#4338CA; font-size:11px; font-weight:700; padding:6px 14px; border-radius:999px; font-family:'Inter',sans-serif;">⚠️ Rows below 80% are highlighted in red</td>
            </tr>
          </table>

          <!-- Attendance data table -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse; width:100%;">
            <thead>
              <tr style="background:#F9FAFB;">
                <th class="att-table-th" style="text-align:left; font-size:10px; font-weight:700; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.8px; padding:10px 8px; border-bottom:2px solid #E5E7EB; font-family:'Inter',sans-serif; width:36%;">Subject</th>
                <th class="att-table-th" style="text-align:center; font-size:10px; font-weight:700; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.8px; padding:10px 8px; border-bottom:2px solid #E5E7EB; font-family:'Inter',sans-serif; width:13%;">Classes</th>
                <th class="att-table-th" style="text-align:center; font-size:10px; font-weight:700; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.8px; padding:10px 8px; border-bottom:2px solid #E5E7EB; font-family:'Inter',sans-serif; width:13%;">Present</th>
                <th class="att-table-th" style="text-align:center; font-size:10px; font-weight:700; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.8px; padding:10px 8px; border-bottom:2px solid #E5E7EB; font-family:'Inter',sans-serif; width:13%;">Absent</th>
                <th class="att-table-th" style="text-align:center; font-size:10px; font-weight:700; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.8px; padding:10px 8px; border-bottom:2px solid #E5E7EB; font-family:'Inter',sans-serif; width:9%;">OD</th>
                <th class="att-table-th" style="text-align:center; font-size:10px; font-weight:700; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.8px; padding:10px 8px; border-bottom:2px solid #E5E7EB; font-family:'Inter',sans-serif; width:16%;">Attendance</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- Footer note -->
          <div class="footer-note-text" style="font-size:11px; color:#9CA3AF; margin-top:16px; line-height:1.6; font-family:'Inter',sans-serif;">Focus on the highlighted subjects to improve your attendance. 🎯</div>

        </td>
      </tr>
    </table>

    <!-- Email footer -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
      <tr>
        <td class="email-footer-cell" style="text-align:center; padding:24px 20px 36px; font-family:'Inter',sans-serif; font-size:12px; color:#9CA3AF; line-height:1.7;">
          This email is sent from <strong style="color:#374151;">Trackify</strong>.<br>
          Need help? Contact <a class="email-footer-link" href="mailto:support@mail.trackifyapp.co.in" style="color:#111827; font-weight:700; text-decoration:none;">support@mail.trackifyapp.co.in</a>
          <div class="email-footer-sig" style="color:#374151; font-weight:700; margin-top:6px;">Happy Learning 📚<br>Team Trackify</div>
        </td>
      </tr>
    </table>

</div>
</body>
</html>`;



  if (previewOnly) {
    return htmlContent;
  }

  const { queueEmail } = require('../utils/emailHelper');
  await queueEmail(student.email, student.name, `Trackify Attendance Summary Report (${startDate} - ${endDate})`, htmlContent, 'notices');

  // Insert summary execution record into new DB logs table
  await db.query(
    "INSERT INTO attendance_summary_logs (user_id, start_date, end_date, status) VALUES ($1, $2, $3, 'sent')",
    [userId, startDate, endDate]
  );
};

/**
 * Sweep students and queue/preview attendance summary emails
 * @param {string} startDate
 * @param {string} endDate
 * @param {boolean} previewOnly
 * @param {string|null} singleUserId
 */
const runSummaryEmailsSweep = async (startDate, endDate, previewOnly = false, singleUserId = null) => {
  let queuedCount = 0;
  const previews = [];

  const globalEmail = await systemSettingsRepository.getSetting('global_email_notifications', 'true');
  if (globalEmail !== 'true') {
    return previewOnly ? [] : 0;
  }

  // 1. Fetch target students
  let query = `
    SELECT u.id, u.name, u.email
    FROM users u
    WHERE u.role = 'student' AND u.is_suspended = FALSE
  `;
  const params = [];
  if (singleUserId) {
    query += ` AND u.id = $1`;
    params.push(singleUserId);
  }
  const studentsRes = await db.query(query, params);

  // 2. Fetch log keys to skip duplicates if background sweep (not single test trigger)
  let sentUserIds = new Set();
  if (!previewOnly && !singleUserId) {
    const logsRes = await db.query(
      "SELECT user_id FROM attendance_summary_logs WHERE start_date = $1 AND end_date = $2 AND status = 'sent'",
      [startDate, endDate]
    );
    logsRes.rows.forEach(log => sentUserIds.add(log.user_id));
  }

  // 3. Sweep and process summary template compilation
  for (const student of studentsRes.rows) {
    if (sentUserIds.has(student.id)) {
      continue; // Skip duplicate dispatch for background sweep
    }
    console.log(`[DEBUG SWEEP]: Processing student: ${student.name} (${student.id})`);

    try {
      if (previewOnly) {
        const html = await send15DayAttendanceSummary(student.id, startDate, endDate, true);
        previews.push({
          email: student.email,
          name: student.name,
          subject: `Trackify Attendance Summary Report (${startDate} - ${endDate})`,
          html
        });
      } else {
        await send15DayAttendanceSummary(student.id, startDate, endDate);
        await auditLogRepository.logAction(
          student.id,
          'EMAIL_DISPATCHED',
          `15-day attendance summary email queued for period (${startDate} to ${endDate})`,
          '127.0.0.1'
        );
        queuedCount++;
      }
    } catch (err) {
      console.error(`Error processing summary email for student ${student.id}:`, err.message);
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

      // Run database backup versioning and prune old backups daily at 02:00 AM IST
      if (currentTimeStr === '02:00') {
        try {
          console.log('[REMINDER SCHEDULER]: Starting daily scheduled remote database backup...');
          const remoteBackupService = require('./remoteBackupService');
          const dateStr = new Date().toISOString().slice(0, 10);
          const version = `auto_backup_${dateStr}_0200`;
          await remoteBackupService.createBackupVersion(version);
          console.log(`[REMINDER SCHEDULER]: Daily remote database backup '${version}' completed successfully.`);
        } catch (backupErr) {
          console.error('[REMINDER SCHEDULER BACKUP ERROR]: Daily scheduled remote backup failed:', backupErr.message);
        }
      }

      // Run low attendance warnings at 18:00 dinner hour
      if (currentTimeStr === '18:00') {
        await runLowAttendanceSweep();
      }

      // Run automated attendance summary emails check at 09:00 morning
      if (currentTimeStr === '09:00') {
        const summaryEnabled = await systemSettingsRepository.getSetting('summary_email_enabled', 'true');
        if (summaryEnabled === 'true') {
          const lastSummaryStr = await systemSettingsRepository.getSetting('last_summary_date');
          const intervalDays = parseInt(await systemSettingsRepository.getSetting('summary_email_interval', '15'), 10);
          
          let lastSummaryDate = lastSummaryStr ? new Date(lastSummaryStr) : null;
          let shouldTrigger = false;
          const today = new Date();
          
          if (!lastSummaryDate) {
            shouldTrigger = true;
          } else {
            const diffTime = Math.abs(today - lastSummaryDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= intervalDays) {
              shouldTrigger = true;
            }
          }

          if (shouldTrigger) {
            console.log(`[SUMMARY SCHEDULE TRIGGER]: Automated interval matched (${intervalDays} days since ${lastSummaryStr || 'never'}). Initiating sweeps...`);
            
            // Calculate date ranges: past intervalDays
            const end = new Date();
            end.setDate(end.getDate() - 1); // Yesterday
            const start = new Date();
            start.setDate(end.getDate() - (intervalDays - 1)); // start of date range

            const formatSqlDate = (d) => d.toISOString().split('T')[0];
            const startDateStr = formatSqlDate(start);
            const endDateStr = formatSqlDate(end);

            await runSummaryEmailsSweep(startDateStr, endDateStr);

            // Update execution mark setting
            const todayStr = formatSqlDate(today);
            await systemSettingsRepository.setSetting('last_summary_date', todayStr);
          }
        }
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
  runLowAttendanceSweep,
  runSummaryEmailsSweep,
  send15DayAttendanceSummary
};
