const { Resend } = require('resend');
const db = require('../config/db');

// Recipient for administrative system alerts
const ALERT_RECIPIENT = 'bharani.cyber@gmail.com';
const ALERT_FROM = process.env.MAIL_FROM || 'Trackify Alerts <trackify@mail.trackifyapp.co.in>';

// Throttling cache for error alerts (5 minute window per error signature)
const errorThrottleMap = new Map();
const THROTTLE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Initialize Resend client instance
 */
const getResendClient = () => {
  if (process.env.RESEND_API_KEY) {
    return new Resend(process.env.RESEND_API_KEY);
  }
  return null;
};

/**
 * Helper to escape HTML characters in dynamic strings
 */
const escapeHtml = (str) => {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Send an email directly via Resend or fallback to persistent DB queue
 */
const dispatchAlertEmail = async (subject, htmlContent) => {
  const resend = getResendClient();

  if (resend) {
    try {
      const result = await resend.emails.send({
        from: ALERT_FROM,
        to: ALERT_RECIPIENT,
        subject: subject,
        html: htmlContent
      });
      console.log(`[ALERT SERVICE]: Direct alert email dispatched to ${ALERT_RECIPIENT} (Subject: "${subject}", ID: ${result.data?.id || 'OK'})`);
      return { success: true, method: 'direct', id: result.data?.id };
    } catch (sendErr) {
      console.error('[ALERT SERVICE ERROR]: Direct Resend send failed, falling back to database queue:', sendErr.message);
    }
  }

  // Fallback: Queue in database
  try {
    const query = `
      INSERT INTO email_queue (recipient_email, recipient_name, subject, html_content, status, category)
      VALUES ($1, $2, $3, $4, 'pending', 'system_alert')
      RETURNING id
    `;
    const result = await db.query(query, [ALERT_RECIPIENT, 'System Administrator', subject, htmlContent]);
    console.log(`[ALERT SERVICE]: Alert queued to database for ${ALERT_RECIPIENT} (Queue ID: ${result.rows[0].id})`);
    return { success: true, method: 'queued', id: result.rows[0].id };
  } catch (dbErr) {
    console.error('[ALERT SERVICE ERROR]: Failed to enqueue alert email:', dbErr.message);
    return { success: false, error: dbErr.message };
  }
};

/**
 * Notify administrator on server rollout / startup
 * @param {object} details
 */
const notifyRolloutDeployed = async (details = {}) => {
  // Rollout emails are disabled by default unless explicitly enabled via ENABLE_ROLLOUT_ALERTS=true
  if (process.env.ENABLE_ROLLOUT_ALERTS !== 'true') {
    return { success: true, disabled: true, message: 'Rollout deployment alert email suppressed' };
  }

  const env = process.env.NODE_ENV || 'production';
  const port = details.port || process.env.PORT || 3000;
  const timestamp = new Date().toISOString();
  const nodeVersion = process.version;
  const appUrl = process.env.APP_URL || 'https://app.trackifyapp.co.in';
  const statusUrl = `${appUrl}/status`;

  const subject = `[ROLLOUT] Trackify Server Online (${env.toUpperCase()} - Port ${port})`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1e293b;">
      <div style="padding-bottom: 16px; border-bottom: 2px solid #2563eb; margin-bottom: 20px;">
        <h2 style="color: #0f172a; margin: 0 0 4px 0; font-size: 20px; font-weight: 700;">Trackify System Rollout Deployed</h2>
        <p style="color: #64748b; margin: 0; font-size: 13px;">Automated Deployment and Startup Broadcast</p>
      </div>

      <p style="font-size: 14px; line-height: 22px; color: #334155; margin-bottom: 20px;">
        The Trackify application server has successfully initialized and is now active and accepting incoming traffic.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
        <tbody>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600; width: 140px;">Environment:</td>
            <td style="padding: 10px 0; color: #0f172a; font-weight: 700;">${escapeHtml(env)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Port / Host:</td>
            <td style="padding: 10px 0; color: #0f172a; font-family: monospace;">${escapeHtml(details.host || '0.0.0.0')}:${escapeHtml(port)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Runtime:</td>
            <td style="padding: 10px 0; color: #0f172a; font-family: monospace;">Node.js ${escapeHtml(nodeVersion)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Timestamp:</td>
            <td style="padding: 10px 0; color: #0f172a; font-family: monospace;">${escapeHtml(timestamp)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">System Status:</td>
            <td style="padding: 10px 0; color: #10b981; font-weight: 700;">Operational</td>
          </tr>
        </tbody>
      </table>

      <div style="margin: 24px 0; text-align: center;">
        <a href="${escapeHtml(statusUrl)}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 700; display: inline-block;">
          View Live System Status
        </a>
      </div>

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">
        Trackify Academic Infrastructure • Automated Operational Telemetry
      </p>
    </div>
  `;

  return dispatchAlertEmail(subject, htmlContent);
};

/**
 * Notify administrator on critical system or service failure
 * @param {object} failureDetails
 */
const notifySystemFailure = async (failureDetails = {}) => {
  const type = failureDetails.type || 'Internal Server Error';
  const errorMessage = failureDetails.error || failureDetails.message || 'Unknown Exception';
  const stack = failureDetails.stack || '';
  const path = failureDetails.path || 'N/A';
  const method = failureDetails.method || 'N/A';
  const ip = failureDetails.ip || 'N/A';
  const timestamp = new Date().toISOString();
  const env = process.env.NODE_ENV || 'production';

  // Throttling: prevent sending duplicate email within 5 minutes for identical type + message
  const throttleKey = `${type}::${errorMessage}::${path}`;
  const now = Date.now();
  const lastSent = errorThrottleMap.get(throttleKey);

  if (lastSent && now - lastSent < THROTTLE_WINDOW_MS) {
    console.warn(`[ALERT SERVICE THROTTLED]: Suppressed duplicate failure alert for "${throttleKey}" (Sent ${Math.round((now - lastSent) / 1000)}s ago)`);
    return { throttled: true };
  }

  errorThrottleMap.set(throttleKey, now);

  const subject = `[CRITICAL ALERT] Trackify System Failure: ${type}`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #ef4444; border-radius: 8px; background-color: #ffffff; color: #1e293b;">
      <div style="padding-bottom: 16px; border-bottom: 2px solid #ef4444; margin-bottom: 20px;">
        <h2 style="color: #dc2626; margin: 0 0 4px 0; font-size: 20px; font-weight: 700;">Critical System Incident Detected</h2>
        <p style="color: #64748b; margin: 0; font-size: 13px;">Immediate Operational Incident Notification</p>
      </div>

      <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; padding: 14px; margin-bottom: 20px;">
        <div style="font-weight: 700; color: #991b1b; font-size: 14px; margin-bottom: 4px;">Incident Type: ${escapeHtml(type)}</div>
        <div style="color: #b91c1c; font-family: monospace; font-size: 13px; word-break: break-all;">${escapeHtml(errorMessage)}</div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
        <tbody>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 130px;">Environment:</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">${escapeHtml(env)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Route / Method:</td>
            <td style="padding: 8px 0; color: #0f172a; font-family: monospace;">${escapeHtml(method)} ${escapeHtml(path)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Client IP:</td>
            <td style="padding: 8px 0; color: #0f172a; font-family: monospace;">${escapeHtml(ip)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Timestamp:</td>
            <td style="padding: 8px 0; color: #0f172a; font-family: monospace;">${escapeHtml(timestamp)}</td>
          </tr>
        </tbody>
      </table>

      ${stack ? `
        <div style="margin-bottom: 20px;">
          <div style="font-weight: 600; font-size: 12px; color: #475569; margin-bottom: 6px;">Stack Trace:</div>
          <pre style="background: #0f172a; color: #f8fafc; padding: 12px; border-radius: 6px; font-size: 11px; overflow-x: auto; font-family: monospace; white-space: pre-wrap;">${escapeHtml(stack.slice(0, 1500))}</pre>
        </div>
      ` : ''}

      <div style="margin: 20px 0; text-align: center;">
        <a href="${escapeHtml((process.env.APP_URL || 'https://app.trackifyapp.co.in') + '/status')}" style="background-color: #dc2626; color: #ffffff; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 700; display: inline-block;">
          Check System Status Page
        </a>
      </div>

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">
        Trackify Health Monitor • Incident Alerting Pipeline
      </p>
    </div>
  `;

  return dispatchAlertEmail(subject, htmlContent);
};

module.exports = {
  notifyRolloutDeployed,
  notifySystemFailure
};
