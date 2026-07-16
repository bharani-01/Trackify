const { Resend } = require('resend');

const sendResetEmail = async (email, resetUrl) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('[EMAIL HELPER WARNING]: RESEND_API_KEY is not defined. Simulating send to console only.');
    return { success: true, simulated: true };
  }

  const resend = new Resend(resendApiKey);

  try {
    const data = await resend.emails.send({
      from: 'Trackify <trackify@bharani-01.xyz>',
      to: [email],
      subject: 'Reset your Trackify Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
          <h2 style="color: #0f172a; margin-bottom: 16px;">Trackify Password Recovery</h2>
          <p style="color: #475569; font-size: 16px; line-height: 24px;">You requested a password reset for your Trackify account. Click the button below to configure your new credentials:</p>
          <div style="margin: 24px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #64748b; font-size: 14px; line-height: 20px;">If the button above does not work, copy and paste the following link into your browser:</p>
          <p style="color: #2563eb; font-size: 14px; word-break: break-all;">${resetUrl}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">This link is valid for 1 hour. If you did not request this email, you can safely ignore it.</p>
        </div>
      `
    });

    console.log('[RESEND EMAIL SENT SUCCESS]:', data);
    return { success: true, data };
  } catch (error) {
    console.error('[RESEND EMAIL SENT ERROR]:', error);
    throw error;
  }
};

module.exports = {
  sendResetEmail
};
