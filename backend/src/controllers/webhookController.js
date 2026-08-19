const db = require('../config/db');
const { Resend } = require('resend');
const { Webhook } = require('svix');

// Helper to extract text and html body content from diverse webhook payload formats
function extractBodyContent(obj) {
  if (!obj || typeof obj !== 'object') return { text: '', html: '' };

  const htmlKeys = ['html', 'html_body', 'htmlBody', 'body_html', 'body-html', 'stripped-html', 'stripped_html', 'raw_html'];
  const textKeys = ['text', 'text_body', 'textBody', 'body_text', 'body-plain', 'plain', 'content', 'stripped-text', 'stripped_text', 'message', 'raw_text'];

  let text = '';
  let html = '';

  for (const key of htmlKeys) {
    if (typeof obj[key] === 'string' && obj[key].trim().length > 0) {
      html = obj[key].trim();
      break;
    }
  }

  for (const key of textKeys) {
    if (typeof obj[key] === 'string' && obj[key].trim().length > 0) {
      text = obj[key].trim();
      break;
    }
  }

  // Deep check nested payload, data, or body objects if top-level search yielded nothing
  if (!text && !html && obj.data && typeof obj.data === 'object') {
    const nested = extractBodyContent(obj.data);
    text = nested.text;
    html = nested.html;
  }

  if (!text && !html && obj.payload && typeof obj.payload === 'object') {
    const nested = extractBodyContent(obj.payload);
    text = nested.text;
    html = nested.html;
  }

  if (!text && !html && obj.body && typeof obj.body === 'object') {
    const nested = extractBodyContent(obj.body);
    text = nested.text;
    html = nested.html;
  }

  return { text, html };
}

// POST /api/webhooks/resend-inbound
const handleResendInboundWebhook = async (req, res) => {
  try {
    const payload = req.body || {};
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

    if (eventType === 'email.received' || data.email_id || data.from || payload.from) {
      const emailId = data.email_id || data.id || payload.id || `inbound_${Date.now()}`;
      
      let fromAddr = 'Unknown Sender';
      const fromObj = data.from || payload.from;
      if (typeof fromObj === 'string') {
        fromAddr = fromObj;
      } else if (fromObj && fromObj.email) {
        fromAddr = fromObj.name ? `${fromObj.name} <${fromObj.email}>` : fromObj.email;
      } else if (Array.isArray(fromObj) && fromObj[0]) {
        fromAddr = typeof fromObj[0] === 'string' ? fromObj[0] : (fromObj[0].email || 'Unknown');
      }

      let toAddr = 'Trackify Support';
      const toObj = data.to || payload.to;
      if (Array.isArray(toObj)) {
        toAddr = toObj.join(', ');
      } else if (typeof toObj === 'string') {
        toAddr = toObj;
      }

      const subject = data.subject || payload.subject || '(No Subject)';
      
      // Extract text and html body content recursively across all property names
      const extracted = extractBodyContent(payload);
      let textBody = extracted.text;
      let htmlBody = extracted.html;

      // If body is missing in webhook payload, attempt to fetch content using Resend API / SDK
      if (!textBody && !htmlBody && (data.email_id || data.id) && process.env.RESEND_API_KEY) {
        const targetId = data.email_id || data.id;
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const emailDetail = await resend.emails.get(targetId);
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

      const rawPayloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

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
        rawPayloadStr
      ]);

      console.log(`[INBOUND EMAIL SAVED]: Saved email from "${fromAddr}" with subject "${subject}" (ID: ${result.rows[0].id})`);
    }

    // Always respond 200 OK to Resend webhooks quickly
    return res.status(200).json({ success: true, message: 'Inbound email event processed successfully' });
  } catch (error) {
    console.error('[RESEND WEBHOOK ERROR]:', error);
    return res.status(200).json({ success: true, error: error.message });
  }
};

module.exports = {
  handleResendInboundWebhook
};
