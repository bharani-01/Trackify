const db = require('../config/db');
const { Resend } = require('resend');
const { Webhook } = require('svix');

// POST /api/webhooks/resend-inbound
const handleResendInboundWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    // Optional Svix Signature Verification (if RESEND_WEBHOOK_SECRET is set in environment)
    if (webhookSecret) {
      const svix_id = req.headers['svix-id'];
      const svix_timestamp = req.headers['svix-timestamp'];
      const svix_signature = req.headers['svix-signature'];

      if (svix_id && svix_timestamp && svix_signature) {
        try {
          const wh = new Webhook(webhookSecret);
          const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
          wh.verify(rawBody, {
            'svix-id': svix_id,
            'svix-timestamp': svix_timestamp,
            'svix-signature': svix_signature
          });
          console.log('[SVIX VERIFIED]: Inbound Resend webhook signature matches!');
        } catch (svixErr) {
          console.error('[SVIX VERIFICATION ERROR]: Invalid webhook signature:', svixErr.message);
          return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
        }
      }
    }

    console.log('[RESEND INBOUND WEBHOOK]: Processing event payload...');

    // Support both direct event payloads and wrapped webhook formats
    const eventType = payload.type || payload.event;
    const data = payload.data || payload;

    if (eventType === 'email.received' || data.email_id || data.from) {
      const emailId = data.email_id || data.id || `inbound_${Date.now()}`;
      
      let fromAddr = 'Unknown Sender';
      if (typeof data.from === 'string') {
        fromAddr = data.from;
      } else if (data.from && data.from.email) {
        fromAddr = data.from.name ? `${data.from.name} <${data.from.email}>` : data.from.email;
      } else if (Array.isArray(data.from) && data.from[0]) {
        fromAddr = typeof data.from[0] === 'string' ? data.from[0] : (data.from[0].email || 'Unknown');
      }

      let toAddr = 'Trackify Support';
      if (Array.isArray(data.to)) {
        toAddr = data.to.join(', ');
      } else if (typeof data.to === 'string') {
        toAddr = data.to;
      }

      const subject = data.subject || '(No Subject)';
      let textBody = data.text || data.text_body || '';
      let htmlBody = data.html || data.html_body || '';

      // If body is missing in webhook payload, attempt to fetch content using Resend SDK
      if (!textBody && !htmlBody && data.email_id && process.env.RESEND_API_KEY) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const emailDetail = await resend.emails.get(data.email_id);
          if (emailDetail && emailDetail.data) {
            textBody = emailDetail.data.text || textBody;
            htmlBody = emailDetail.data.html || htmlBody;
          }
        } catch (fetchErr) {
          console.warn('[INBOUND EMAIL FETCH NOTICE]: Could not fetch email body via SDK:', fetchErr.message);
        }
      }

      if (!textBody && !htmlBody) {
        textBody = `Incoming email received from ${fromAddr}.`;
      }

      // Save to Supabase inbound_emails table
      const insertQuery = `
        INSERT INTO inbound_emails (email_id, from_address, to_address, subject, text_body, html_body, status, raw_payload)
        VALUES ($1, $2, $3, $4, $5, $6, 'unread', $7)
        ON CONFLICT (email_id) DO UPDATE SET
          from_address = EXCLUDED.from_address,
          to_address = EXCLUDED.to_address,
          subject = EXCLUDED.subject,
          text_body = EXCLUDED.text_body,
          html_body = EXCLUDED.html_body,
          raw_payload = EXCLUDED.raw_payload
        RETURNING *;
      `;

      const result = await db.query(insertQuery, [
        emailId,
        fromAddr,
        toAddr,
        subject,
        textBody,
        htmlBody,
        JSON.stringify(payload)
      ]);

      console.log(`[INBOUND EMAIL SAVED]: Saved email from "${fromAddr}" with subject "${subject}" (ID: ${result.rows[0].id})`);
    }

    // Always respond 200 OK to Resend webhooks quickly
    return res.status(200).json({ success: true, message: 'Inbound email event processed successfully' });
  } catch (error) {
    console.error('[RESEND WEBHOOK ERROR]:', error);
    return res.status(200).json({ success: false, error: error.message });
  }
};

module.exports = {
  handleResendInboundWebhook
};
