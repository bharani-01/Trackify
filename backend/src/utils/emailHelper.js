const { Resend } = require('resend');
const db = require('../config/db');

/**
 * Queue an email to the persistent database email_queue table
 */
const queueEmail = async (email, name, subject, htmlContent) => {
  const query = `
    INSERT INTO email_queue (recipient_email, recipient_name, subject, html_content, status)
    VALUES ($1, $2, $3, $4, 'pending')
    RETURNING id
  `;
  try {
    const result = await db.query(query, [email.toLowerCase().trim(), name.trim(), subject.trim(), htmlContent]);
    console.log(`[EMAIL QUEUE]: Email queued for ${email} with Queue ID: ${result.rows[0].id}`);
    return result.rows[0].id;
  } catch (error) {
    console.error('[EMAIL QUEUE ERROR]: Failed to enqueue email:', error.message);
    throw error;
  }
};

const escapeHtml = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const sendResetEmail = async (email, resetUrl) => {
  const safeUrl = escapeHtml(resetUrl);
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #0f172a; margin-bottom: 16px;">Trackify Password Recovery</h2>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">You requested a password reset for your Trackify account. Click the button below to configure your new credentials:</p>
      <div style="margin: 24px 0;">
        <a href="${safeUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #64748b; font-size: 14px; line-height: 20px;">If the button above does not work, copy and paste the following link into your browser:</p>
      <p style="color: #2563eb; font-size: 14px; word-break: break-all;">${safeUrl}</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">This link is valid for 1 hour. If you did not request this email, you can safely ignore it.</p>
    </div>
  `;
  
  await queueEmail(email, 'Student', 'Reset your Trackify Password', htmlContent);
  return { success: true, queued: true };
};

const sendSettingsUpdatedEmail = async (email, name, details) => {
  const safeName = escapeHtml(name);
  const safeDetails = escapeHtml(details).replace(/\n/g, '<br>');
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; background-color: #ffffff;">
      <h2 style="color: #0f172a; margin-bottom: 16px;">Trackify Settings Alert</h2>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">Hello ${safeName},</p>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">This is to confirm that your Trackify profile configurations were recently updated:</p>
      <div style="margin: 20px 0; padding: 15px; background-color: #f8fafc; border: 1px solid #e2e8f0; font-family: monospace; font-size: 14px; color: #334155;">
        ${safeDetails}
      </div>
      <p style="color: #64748b; font-size: 14px;">If you did not perform this change, please contact your university administrator immediately.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">This is an automated security transmission. Please do not reply directly to this message.</p>
    </div>
  `;

  await queueEmail(email, name, 'Trackify Profile Settings Updated', htmlContent);
  return { success: true, queued: true };
};

const sendOtpEmail = async (email, name, otpCode, purpose) => {
  const safeName = escapeHtml(name);
  const safeOtp = escapeHtml(otpCode);
  const actionText = purpose === 'login' ? 'login to your account' : 'reset your account password';
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #0f172a; margin-bottom: 16px;">Trackify Security Verification</h2>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">Hello ${safeName},</p>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">Your One-Time Verification Code (OTP) to ${actionText} is:</p>
      <div style="margin: 24px 0; text-align: center;">
        <span style="font-family: monospace; font-size: 32px; font-weight: 800; color: #2563eb; letter-spacing: 4px; padding: 10px 20px; background-color: #f1f5f9; border: 1px dashed #cbd5e1; display: inline-block;">${safeOtp}</span>
      </div>
      <p style="color: #64748b; font-size: 14px; line-height: 20px;">This verification code is valid for 5 minutes. Do not share this code with anyone.</p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">If you did not request this OTP, you can safely ignore this email.</p>
    </div>
  `;
  
  await queueEmail(email, name, `Your Trackify verification code: ${safeOtp}`, htmlContent);
  return { success: true, queued: true };
};

const sendWelcomeRegistrationEmail = async (email, name, isApproved) => {
  const safeName = escapeHtml(name);
  const titleText = isApproved !== false ? 'Welcome to Trackify' : 'Registration Received - Pending Approval';
  const statusText = isApproved !== false
    ? 'Your Trackify account has been created successfully. You can now sign in to start tracking your attendance and schedules.'
    : 'Your Trackify account registration has been received successfully. Your account is currently pending administrative review and approval. We will notify you via email as soon as your administrator approves your access.';
  
  const buttonHtml = isApproved !== false
    ? `<div style="margin: 24px 0;"><a href="http://localhost:3000/login" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Log In Now</a></div>`
    : '';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #2563eb; margin-bottom: 16px;">${titleText}</h2>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">Hello ${safeName},</p>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">${statusText}</p>
      ${buttonHtml}
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">Trackify Academic Management System</p>
    </div>
  `;

  await queueEmail(email, name, titleText, htmlContent);
  return { success: true, queued: true };
};

const sendAccountApprovedEmail = async (email, name) => {
  const safeName = escapeHtml(name);
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #10b981; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #10b981; margin-bottom: 16px;">Account Registration Approved!</h2>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">Hello ${safeName},</p>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">Great news! Your Trackify student account registration has been reviewed and approved by the administrator.</p>
      <p style="color: #475569; font-size: 16px; line-height: 24px;">You now have full access to log attendance, view schedules, and analyze performance.</p>
      <div style="margin: 24px 0;">
        <a href="http://localhost:3000/login" style="background-color: #10b981; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Log In To Trackify</a>
      </div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">Trackify Academic Management System</p>
    </div>
  `;

  await queueEmail(email, name, 'Account Approved - Welcome to Trackify', htmlContent);
  return { success: true, queued: true };
};

module.exports = {
  sendResetEmail,
  sendSettingsUpdatedEmail,
  sendOtpEmail,
  sendWelcomeRegistrationEmail,
  sendAccountApprovedEmail,
  queueEmail
};
