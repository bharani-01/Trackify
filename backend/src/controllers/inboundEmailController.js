const db = require('../config/db');
const { Resend } = require('resend');

// GET /api/admin/inbound-emails - Fetch paginated inbound emails with filters
const getInboundEmails = async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '15', 10);
    const offset = (page - 1) * limit;
    const status = req.query.status || 'all';
    const search = req.query.search || '';

    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;

    if (status !== 'all') {
      whereConditions.push(`status = $${paramCount}`);
      queryParams.push(status);
      paramCount++;
    }

    if (search) {
      whereConditions.push(`(from_address ILIKE $${paramCount} OR subject ILIKE $${paramCount} OR text_body ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM inbound_emails ${whereClause};`;
    const countResult = await db.query(countQuery, queryParams);
    const totalItems = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `
      SELECT id, email_id, from_address, to_address, subject, status, replied_at, reply_message, received_at
      FROM inbound_emails
      ${whereClause}
      ORDER BY received_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1};
    `;

    queryParams.push(limit, offset);
    const dataResult = await db.query(dataQuery, queryParams);

    // Get unread count for badge
    const unreadResult = await db.query(`SELECT COUNT(*) FROM inbound_emails WHERE status = 'unread';`);
    const unreadCount = parseInt(unreadResult.rows[0].count, 10);

    return res.status(200).json({
      success: true,
      data: dataResult.rows,
      pagination: {
        total: totalItems,
        page,
        limit,
        totalPages: Math.ceil(totalItems / limit)
      },
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching inbound emails:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch inbound emails' });
  }
};

// GET /api/admin/inbound-emails/:id - Get email details & mark as read
const getInboundEmailById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`SELECT * FROM inbound_emails WHERE id = $1;`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Inbound email not found' });
    }

    const email = result.rows[0];

    // Automatically mark unread emails as read when opened
    if (email.status === 'unread') {
      await db.query(`UPDATE inbound_emails SET status = 'read' WHERE id = $1;`, [id]);
      email.status = 'read';
    }

    // Fallback attempt: if body is placeholder or empty, fetch live from Resend Receiving API
    if ((!email.html_body && (!email.text_body || email.text_body.startsWith('Incoming email received from'))) && email.email_id && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const detail = await resend.emails.receiving.get(email.email_id);
        if (detail && detail.data && detail.data.raw && detail.data.raw.download_url) {
          const rawRes = await fetch(detail.data.raw.download_url);
          const mimeText = await rawRes.text();
          
          const decodeQP = (s) => {
            if (!s) return '';
            const clean = s.replace(/=\r?\n/g, '');
            return clean.replace(/(?:=[0-9A-Fa-f]{2})+/g, (m) => {
              try {
                return Buffer.from(m.replace(/=/g, ''), 'hex').toString('utf-8');
              } catch (_) {
                return m;
              }
            });
          };
          let text = '';
          let html = '';
          const htmlMatch = mimeText.match(/Content-Type:\s*text\/html;?[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*?\r?\n([\s\S]*?)(?=\r?\n--[^\r\n]+--|\r?\n--[^\r\n]+|$)/i);
          if (htmlMatch && htmlMatch[1]) html = decodeQP(htmlMatch[1].trim());

          const textMatch = mimeText.match(/Content-Type:\s*text\/plain;?[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*?\r?\n([\s\S]*?)(?=\r?\n--[^\r\n]+--|\r?\n--[^\r\n]+|$)/i);
          if (textMatch && textMatch[1]) text = decodeQP(textMatch[1].trim());

          if (text || html) {
            email.text_body = text || email.text_body;
            email.html_body = html || email.html_body;
            await db.query(`UPDATE inbound_emails SET text_body = $1, html_body = $2 WHERE id = $3;`, [email.text_body, email.html_body, id]);
          }
        }
      } catch (err) {
        console.warn('[INBOUND EMAIL FETCH NOTICE]: Could not auto-fetch body from Resend API:', err.message);
      }
    }

    return res.status(200).json({
      success: true,
      data: email
    });
  } catch (error) {
    console.error('Error fetching email details:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch email details' });
  }
};

// POST /api/admin/inbound-emails/:id/reply - Reply to sender via Resend SDK
const replyToInboundEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { replyMessage, subject: customSubject } = req.body;

    if (!replyMessage || !replyMessage.trim()) {
      return res.status(400).json({ success: false, message: 'Reply message text is required' });
    }

    const emailResult = await db.query(`SELECT * FROM inbound_emails WHERE id = $1;`, [id]);
    if (emailResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Inbound email not found' });
    }

    const emailRecord = emailResult.rows[0];

    // Extract raw target email address from "Name <email@domain.com>" or "email@domain.com"
    let recipientEmail = emailRecord.from_address;
    const emailMatch = recipientEmail.match(/<([^>]+)>/);
    if (emailMatch && emailMatch[1]) {
      recipientEmail = emailMatch[1].trim();
    } else {
      recipientEmail = recipientEmail.trim();
    }

    const systemSettingsRepository = require('../repositories/systemSettingsRepository');
    const replySubject = customSubject || (emailRecord.subject.startsWith('Re:') ? emailRecord.subject : `Re: ${emailRecord.subject}`);
    let fromSender = await systemSettingsRepository.getSetting('mail_from_support');
    if (!fromSender) {
      fromSender = process.env.MAIL_FROM_SUPPORT || process.env.MAIL_FROM || 'Trackify Support <support@mail.trackifyapp.co.in>';
    }
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      return res.status(500).json({ success: false, message: 'RESEND_API_KEY environment variable is not configured' });
    }

    const resend = new Resend(resendApiKey);

    // Format rich HTML response container
    const formattedHtmlBody = `
      <div style="font-family: Arial, sans-serif; font-size: 15px; color: #1e293b; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; background-color: #ffffff;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #1e293b; font-size: 20px;">Trackify Support Reply</h2>
        </div>
        <div style="margin-bottom: 24px; white-space: pre-wrap;">${replyMessage.replace(/\n/g, '<br>')}</div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <div style="font-size: 13px; color: #64748b; background-color: #f8fafc; padding: 12px; border-radius: 6px;">
          <strong>Original Message:</strong><br />
          <strong>From:</strong> ${emailRecord.from_address}<br />
          <strong>Received:</strong> ${new Date(emailRecord.received_at).toLocaleString()}<br />
          <strong>Subject:</strong> ${emailRecord.subject}<br /><br />
          <em>${(emailRecord.text_body || emailRecord.html_body || '').substring(0, 300)}...</em>
        </div>
        <div style="margin-top: 20px; font-size: 12px; color: #94a3b8; text-align: center;">
          Sent by Trackify System Administration &bull; <a href="https://app.trackifyapp.co.in" style="color: #2563eb; text-decoration: none;">trackifyapp.co.in</a>
        </div>
      </div>
    `;

    // Send email via Resend
    const sendResult = await resend.emails.send({
      from: fromSender,
      to: [recipientEmail],
      subject: replySubject,
      html: formattedHtmlBody
    });

    if (sendResult.error) {
      console.error('[RESEND REPLY ERROR]:', sendResult.error);
      return res.status(500).json({ success: false, message: `Failed to send email: ${sendResult.error.message}` });
    }

    // Update database record status to 'replied'
    const updated = await db.query(
      `UPDATE inbound_emails SET status = 'replied', replied_at = NOW(), reply_message = $1 WHERE id = $2 RETURNING *;`,
      [replyMessage, id]
    );

    console.log(`[INBOUND EMAIL REPLIED]: Sent reply to ${recipientEmail} for email ID ${id}`);

    return res.status(200).json({
      success: true,
      message: `Reply sent successfully to ${recipientEmail}`,
      data: updated.rows[0]
    });
  } catch (error) {
    console.error('Error replying to inbound email:', error);
    return res.status(500).json({ success: false, message: `Failed to send reply: ${error.message}` });
  }
};

// PUT /api/admin/inbound-emails/:id/status - Update status (unread, read, archived)
const updateInboundEmailStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['unread', 'read', 'replied', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status provided' });
    }

    const result = await db.query(`UPDATE inbound_emails SET status = $1 WHERE id = $2 RETURNING *;`, [status, id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Inbound email not found' });
    }

    return res.status(200).json({
      success: true,
      message: `Email status updated to ${status}`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating email status:', error);
    return res.status(500).json({ success: false, message: 'Failed to update email status' });
  }
};

// DELETE /api/admin/inbound-emails/:id - Delete email record
const deleteInboundEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`DELETE FROM inbound_emails WHERE id = $1 RETURNING *;`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Inbound email not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Inbound email deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting inbound email:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete inbound email' });
  }
};

module.exports = {
  getInboundEmails,
  getInboundEmailById,
  replyToInboundEmail,
  updateInboundEmailStatus,
  deleteInboundEmail
};
