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
const sendDailyMarkingReminder = async (email, name) => {
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
  
  await queueEmail(email, name, 'Daily Attendance Marking Reminder', htmlContent);
};

/**
 * Queue an automated low attendance warning alert
 */
const sendLowAttendanceWarning = async (email, name, percentage, target) => {
  const { queueEmail } = require('../utils/emailHelper');
  const safeName = escapeHtml(name);
  const safePercent = escapeHtml(percentage?.toString());
  const safeTarget = escapeHtml(target?.toString());
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ef4444; background-color: #ffffff;">
      <h2 style="color: #ef4444; margin-bottom: 16px;">Attendance Threshold Warning</h2>
      <p style="color: #475569; font-size: 16px;">Hello ${safeName},</p>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">Your attendance average has fallen below your configured minimum academic target percentage threshold:</p>
      <div style="margin: 20px 0; padding: 15px; background-color: #fef2f2; border: 1px solid #fca5a5; font-family: monospace; font-size: 16px; color: #b91c1c; font-weight: bold;">
        Current Attendance: ${safePercent}%<br>
        Configured target: ${safeTarget}%
      </div>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">Please review your class schedules and log outstanding OD/ML records immediately to ensure compliance.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">This is an automated performance warning broadcast system. You can toggle threshold alarms in your Profile page.</p>
    </div>
  `;

  await queueEmail(email, name, 'Urgent: Low Attendance Warning Alert', htmlContent);
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
        await resend.emails.send({
          from: 'Trackify <trackify@bharani-01.xyz>',
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
 * Start the background cron reminder process
 */
const startScheduler = () => {
  console.log('[REMINDER SCHEDULER SERVICE]: Initializing background cron task daemon...');

  // 1. Run the checker loop every 60 seconds for daily schedule matching
  setInterval(async () => {
    try {
      const now = new Date();
      // Format time as HH:MM matching student configuration inputs
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      // Process Daily Marking Reminders
      const dailyReminderQuery = `
        SELECT u.id, u.name, u.email, s.email_timer
        FROM users u
        JOIN settings s ON u.id = s.user_id
        WHERE u.role = 'student' 
          AND s.daily_reminders = TRUE 
          AND s.email_timer = $1
          AND u.is_suspended = FALSE
      `;
      const dailyRes = await db.query(dailyReminderQuery, [currentTimeStr]);
      for (const row of dailyRes.rows) {
        await sendDailyMarkingReminder(row.email, row.name);
        await auditLogRepository.logAction(row.id, 'EMAIL_DISPATCHED', `Daily attendance marking reminder queued automatically at ${currentTimeStr}`, '127.0.0.1');
      }

      // Process Low Attendance warnings (Only once per day at 18:00 Dinner hour to prevent spamming)
      if (currentTimeStr === '18:00') {
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
        const lowRes = await db.query(lowAttendanceQuery);
        for (const student of lowRes.rows) {
          const currentPercentage = student.percentage;
          const target = student.minimum_attendance || 80;
          if (currentPercentage !== null && currentPercentage < target) {
            await sendLowAttendanceWarning(student.email, student.name, currentPercentage, target);
            await auditLogRepository.logAction(student.id, 'EMAIL_DISPATCHED', `Automated low attendance warning email queued (${currentPercentage}% vs target ${target}%)`, '127.0.0.1');
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
  startScheduler
};
