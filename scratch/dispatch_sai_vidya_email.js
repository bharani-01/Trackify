require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');
const db = require('../backend/src/config/db');

async function sendEmail() {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not defined in environment variables');
    }

    const resend = new Resend(resendApiKey);

    // Read the finalized HTML content
    const htmlPath = path.join(__dirname, '../docs/preview_email_sai_vidya.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    const recipientEmail = 'saividya2007@gmail.com';
    const recipientName = 'Sai Vidya M';
    const subject = 'Your ML Ops Lab class count has been corrected.';
    const sender = process.env.MAIL_FROM || 'Trackify Support <support@mail.trackifyapp.co.in>';

    console.log(`[DISPATCH]: Sending email to ${recipientEmail} via Resend...`);
    console.log(`[DISPATCH]: Sender: "${sender}"`);
    console.log(`[DISPATCH]: Subject: "${subject}"`);

    const result = await resend.emails.send({
      from: sender,
      to: [recipientEmail],
      subject: subject,
      html: htmlContent
    });

    console.log('[DISPATCH SUCCESS]: Resend API Response:', result);

    if (result.error) {
      console.error('[DISPATCH ERROR]:', result.error);
      throw new Error(`Resend send failed: ${result.error.message}`);
    }

    const resendId = result.data ? result.data.id : 'SENT';

    // 1. Record into email_queue
    const insertQueueQuery = `
      INSERT INTO email_queue (recipient_email, recipient_name, subject, html_content, status, category)
      VALUES ($1, $2, $3, $4, 'sent', 'support')
      RETURNING id
    `;
    const queueRes = await db.query(insertQueueQuery, [recipientEmail, recipientName, subject, htmlContent]);
    const queueId = queueRes.rows[0].id;
    console.log(`[DATABASE]: Queued email recorded with ID: ${queueId}`);

    // 2. Fetch student user ID for audit log
    const userRes = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [recipientEmail.toLowerCase().trim()]);
    const userId = userRes.rows.length > 0 ? userRes.rows[0].id : null;

    // 3. Log to audit_logs
    const insertAuditQuery = `
      INSERT INTO audit_logs (user_id, action, details, ip_address, device_type)
      VALUES ($1, 'SUPPORT_EMAIL_DISPATCHED', $2, '127.0.0.1', 'server')
      RETURNING id
    `;
    const auditDetails = `Dispatched attendance correction notice to ${recipientName} (${recipientEmail}) via Resend (ID: ${resendId})`;
    await db.query(insertAuditQuery, [userId, auditDetails]);
    console.log(`[DATABASE]: Audit log recorded successfully.`);

    console.log('\n=============================================');
    console.log(` Email successfully delivered to ${recipientEmail}`);
    console.log(` Resend Message ID: ${resendId}`);
    console.log('=============================================\n');

    process.exit(0);
  } catch (error) {
    console.error('[CRITICAL DISPATCH EXCEPTION]:', error);
    process.exit(1);
  }
}

sendEmail();
