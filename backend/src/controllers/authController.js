const crypto = require('crypto');
const userRepository = require('../repositories/userRepository');
const systemSettingsRepository = require('../repositories/systemSettingsRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const { hashPassword, comparePassword, generateToken } = require('../utils/authHelper');
const { sendResetEmail, sendOtpEmail, sendWelcomeRegistrationEmail } = require('../utils/emailHelper');

/**
 * Constant-time comparison for OTP strings to prevent timing attack vulnerabilities
 * @param {string} a 
 * @param {string} b 
 * @returns {boolean}
 */
const timingSafeEqualString = (a, b) => {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Validate password complexity server-side (minimum 8 characters)
 * @param {string} password 
 * @returns {boolean}
 */
const isPasswordStrong = (password) => {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 8;
};

/**
 * Helper to set JWT token cookie in response
 */
const sendTokenCookie = (user, statusCode, res) => {
  const token = generateToken({ id: user.id, role: user.role, email: user.email });

  const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE || '180', 10);
  const cookieOptions = {
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  };

  // Determine redirection target based on role and approval status
  let redirectUrl = '/pending-approval';
  if (user.is_approved !== false) {
    redirectUrl = user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard';
  }

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      token, // Include token in body to simplify mobile app authorization headers
      pendingApproval: user.is_approved === false,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        register_number: user.register_number,
        department: user.department,
        semester: user.semester,
        is_approved: user.is_approved
      },
      redirectUrl
    });
};

/**
 * Register User
 * @route POST /api/auth/register
 */
const register = async (req, res) => {
  const { name, register_number, email, password, department, semester } = req.body;

  try {
    // 1. Check if public registration is enabled in global settings
    const allowSelfReg = await systemSettingsRepository.getSetting('allow_self_registration', 'true');
    if (allowSelfReg !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'Public registration is currently disabled by the administrator.'
      });
    }

    // 2. Validation
    if (!name || !register_number || !email || !password || !department || !semester) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, register number, email, password, department, and semester'
      });
    }

    // 3. Check if user already exists (by email)
    const userExistsByEmail = await userRepository.findByEmail(email);
    if (userExistsByEmail) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    // 4. Hash password
    const password_hash = await hashPassword(password);

    // 5. Create user pending approval (is_approved: false)
    const newUser = await userRepository.createUser({
      name,
      register_number,
      email,
      password_hash,
      role: 'student',
      department,
      semester: parseInt(semester, 10),
      is_approved: false
    });

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(newUser.id, 'REGISTER', `User registered pending approval: ${name} (${register_number})`, ip);

    // Trigger welcome/pending email notification to user
    try {
      await sendWelcomeRegistrationEmail(newUser.email, newUser.name, false);
    } catch (emailErr) {
      console.error('[REGISTRATION EMAIL WARNING]: Failed to queue welcome email:', emailErr.message);
    }

    return sendTokenCookie(newUser, 201, res);
  } catch (error) {
    console.error('Registration controller error:', error);
    
    // Check for PostgreSQL unique constraint violations (e.g. register number already exists)
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Registration number or email already in use'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Server error during registration. Please try again.'
    });
  }
};

/**
 * Login User
 * @route POST /api/auth/login
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    // 1. Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Safe password preview for audit logging (e.g. "pa***" [Length: 8])
    const safePassPreview = password.length > 2
      ? `${password.substring(0, 2)}*** [Length: ${password.length}]`
      : `[Length: ${password.length}]`;

    // 2. Fetch user
    const user = await userRepository.findByEmail(email);
    if (!user) {
      await auditLogRepository.logAction(
        null,
        'FAILED_LOGIN_ATTEMPT',
        `Failed login attempt - User not found. Attempted Email: ${email} | Attempted Password: ${safePassPreview}`,
        ip,
        userAgent
      );

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (user.is_suspended) {
      await auditLogRepository.logAction(
        user.id,
        'SUSPENDED_LOGIN_ATTEMPT',
        `Suspended user attempted to log in (${user.email})`,
        ip,
        userAgent
      );

      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended by an administrator.'
      });
    }

    // 3. Compare passwords
    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      await auditLogRepository.logAction(
        user.id,
        'FAILED_LOGIN_ATTEMPT',
        `Failed login attempt - Incorrect password for user: ${user.name} (${email}) | Attempted Password: ${safePassPreview}`,
        ip,
        userAgent
      );

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // 4. Send cookie & response
    await auditLogRepository.logAction(user.id, 'LOGIN', `User logged in: ${user.name} (${user.email})`, ip, userAgent);
    sendTokenCookie(user, 200, res);
  } catch (error) {
    console.error('Login controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login. Please try again.'
    });
  }
};

/**
 * Get current logged in user details
 * @route GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    // req.user was populated by protect middleware
    return res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('getMe controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving session.'
    });
  }
};

/**
 * Logout User / Clear Cookie
 * @route POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (req.user) {
      await auditLogRepository.logAction(req.user.id, 'LOGOUT', `User logged out: ${req.user.name}`, ip);
    }

    res.cookie('token', '', {
      expires: new Date(Date.now() + 1000), // Expire immediately (1 second)
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    return res.status(200).json({
      success: true,
      message: 'User logged out successfully'
    });
  } catch (error) {
    console.error('Logout controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during logout.'
    });
  }
};

/**
 * Request Password Reset Token
 * @route POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user account found with that email address'
      });
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(20).toString('hex');
    
    // Set expiry to 1 hour from now
    const resetExpires = new Date(Date.now() + 3600000);

    // Save to database
    await userRepository.updateResetToken(user.id, resetToken, resetExpires);

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(user.id, 'PASSWORD_RESET_REQUEST', `Password reset token requested for ${user.email}`, ip);

    // Build reset link (dynamic protocol & host)
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;

    // SECURITY: Never log full reset URLs — they contain secret tokens.
    // Only log a safe prefix in non-production environments for debugging.
    if (process.env.NODE_ENV !== 'production') {
      const sanitizedLog = `[PASSWORD RESET] Token generated for user ID: ${user.id} (email redacted)`;
      console.log(sanitizedLog);
    }

    // Send email via Resend
    let emailSent = false;
    let emailError = null;
    try {
      await sendResetEmail(user.email, resetUrl);
      emailSent = true;
    } catch (err) {
      emailError = err.message;
      console.error('[FORGOT PASSWORD EMAIL ERROR]:', err);
    }

    // Return the link in development/testing mode for easy copy-paste
    const responsePayload = {
      success: true,
      message: emailSent 
        ? 'Password recovery email sent successfully. Please check your inbox.' 
        : `Email delivery failed (${emailError}). Reset link logged to console.`
    };
    
    if (process.env.NODE_ENV !== 'production' || !emailSent) {
      responsePayload.devResetUrl = resetUrl;
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('ForgotPassword controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating password reset token.'
    });
  }
};

/**
 * Reset Password using Token
 * @route POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  const { token, password, confirmPassword } = req.body;

  try {
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Reset token and password are required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Verify token validity
    const user = await userRepository.findByResetToken(token);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired'
      });
    }

    // Hash the new password
    const passwordHash = await hashPassword(password);

    // Save and clear tokens
    await userRepository.updatePasswordAndClearToken(user.id, passwordHash);

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(user.id, 'PASSWORD_RESET_COMPLETED', `Password reset completed for user ${user.email}`, ip);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new credentials.'
    });
  } catch (error) {
    console.error('ResetPassword controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error resetting password.'
    });
  }
};

/**
 * Get public self-registration configuration status
 * @route GET /api/auth/registration-status
 */
const getRegistrationStatus = async (req, res) => {
  try {
    const allowSelfReg = await systemSettingsRepository.getSetting('allow_self_registration', 'true');
    return res.status(200).json({
      success: true,
      allowSelfRegistration: allowSelfReg === 'true',
      googleClientId: process.env.GOOGLE_CLIENT_ID || ''
    });
  } catch (error) {
    console.error('getRegistrationStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving configuration'
    });
  }
};

/**
 * Update Profile Name and Email
 * @route PUT /api/auth/me
 */
const updateProfile = async (req, res) => {
  const { name, email } = req.body;

  try {
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required.'
      });
    }

    const updatedUser = await userRepository.updateProfile(req.user.id, name, email);
    
    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(req.user.id, 'PROFILE_UPDATED', `Profile name/email updated: ${email}`, ip);

    // Dispatch settings update alert emails & log email activities
    try {
      const { sendSettingsUpdatedEmail } = require('../utils/emailHelper');
      const details = `Name: ${name}\nEmail: ${email}`;
      
      await sendSettingsUpdatedEmail(email, name, details);
      await auditLogRepository.logAction(req.user.id, 'EMAIL_DISPATCHED', `Settings update notification email sent to ${email}`, ip);

      if (req.user.email && req.user.email.toLowerCase() !== email.toLowerCase()) {
        await sendSettingsUpdatedEmail(req.user.email, name, `Your account email address was recently updated to ${email}`);
        await auditLogRepository.logAction(req.user.id, 'EMAIL_DISPATCHED', `Security change warning email sent to ${req.user.email}`, ip);
      }
    } catch (emailErr) {
      console.error('Non-blocking error dispatching settings email alerts:', emailErr.message);
    }

    return res.status(200).json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error('updateProfile controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating profile details.'
    });
  }
};

/**
 * Send OTP Code to user email for login or forgot password reset
 * @route POST /api/auth/otp/send
 */
const sendOtp = async (req, res) => {
  const { email, purpose } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide email address' });
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'No user account found with that email address' });
    }

    // Generate 6 digit numeric code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    await userRepository.updateOtp(user.id, otp, expires);

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(user.id, 'OTP_REQUESTED', `OTP code sent to user email for ${purpose || 'verification'}`, ip);

    // Send email enqueued
    let emailSent = false;
    let emailErr = null;
    try {
      await sendOtpEmail(user.email, user.name || 'User', otp, purpose || 'login');
      emailSent = true;
    } catch (e) {
      emailErr = e.message;
      console.error('[OTP EMAIL SEND ERROR]:', e);
    }

    const responsePayload = {
      success: true,
      message: emailSent
        ? 'Verification code sent to your email successfully. (Please check your spam or junk folder if you do not see it in a few minutes.)'
        : `Failed to deliver email: ${emailErr}. OTP code logged to console.`
    };

    if (process.env.NODE_ENV !== 'production' || !emailSent) {
      responsePayload.devOtp = otp;
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('sendOtp controller error:', error);
    return res.status(500).json({ success: false, message: 'Server error generating verification code.' });
  }
};

/**
 * Verify OTP and log user in
 * @route POST /api/auth/otp/login
 */
const verifyOtpLogin = async (req, res) => {
  const { email, otp } = req.body;
  try {
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'No user account found with that email address' });
    }

    if (!user.otp_code || !timingSafeEqualString(user.otp_code, String(otp)) || new Date(user.otp_expires) < new Date()) {
      return res.status(400).json({ success: false, message: 'Verification code is invalid or has expired' });
    }

    // Clear OTP code from DB
    await userRepository.clearOtp(user.id);

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(user.id, 'OTP_LOGIN_VERIFIED', `User successfully authenticated via OTP login`, ip);

    // Issue token cookie
    sendTokenCookie(user, 200, res);
  } catch (error) {
    console.error('verifyOtpLogin controller error:', error);
    return res.status(500).json({ success: false, message: 'Server error during OTP verification.' });
  }
};

/**
 * Verify OTP and reset password
 * @route POST /api/auth/otp/reset
 */
const verifyOtpResetPassword = async (req, res) => {
  const { email, otp, password, confirmPassword } = req.body;
  try {
    if (!email || !otp || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All inputs are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    if (!isPasswordStrong(password)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'No user account found with that email address' });
    }

    if (!user.otp_code || !timingSafeEqualString(user.otp_code, String(otp)) || new Date(user.otp_expires) < new Date()) {
      return res.status(400).json({ success: false, message: 'Verification code is invalid or has expired' });
    }

    // Clear OTP code from DB
    await userRepository.clearOtp(user.id);

    // Update password
    const passwordHash = await hashPassword(password);
    await userRepository.updatePasswordAndClearToken(user.id, passwordHash);

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(user.id, 'PASSWORD_RESET_COMPLETED', `Password reset successfully completed via OTP verification`, ip);

    return res.status(200).json({ success: true, message: 'Your password has been successfully reset. Please sign in.' });
  } catch (error) {
    console.error('verifyOtpResetPassword controller error:', error);
    return res.status(500).json({ success: false, message: 'Server error during password reset.' });
  }
};

/**
 * Log client-side error to backend audit logs database
 * @route POST /api/auth/log-error
 */
const logError = async (req, res) => {
  const { error, details } = req.body;
  try {
    let userId = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = verifyToken(token);
        if (decoded) userId = decoded.id;
      } catch (_) {}
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(userId, 'CLIENT_ERROR', `Error: ${error}\nDetails: ${details}`, ip);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('logError controller error:', err);
    return res.status(500).json({ success: false });
  }
};

/**
 * Helper to decode and verify Google ID token payload
 */
const verifyGoogleToken = (idToken) => {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    
    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
      return null;
    }
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }
    
    return {
      email: payload.email,
      name: payload.name,
      googleId: payload.sub,
      emailVerified: payload.email_verified
    };
  } catch (err) {
    console.error('Error parsing Google ID token:', err.message);
    return null;
  }
};

/**
 * Authenticate or Register via Google OAuth
 * @route POST /api/auth/google
 */
const googleAuth = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({
      success: false,
      message: 'Google credential ID token is required'
    });
  }

  try {
    const googleUser = verifyGoogleToken(idToken);
    if (!googleUser || !googleUser.email) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired Google authentication token.'
      });
    }

    // 1. Check if user already exists
    let user = await userRepository.findByEmail(googleUser.email);

    if (user) {
      if (user.is_suspended) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been suspended by the administrator.'
        });
      }

      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await auditLogRepository.logAction(
        user.id,
        'GOOGLE_LOGIN_SUCCESS',
        `Logged in via Google OAuth (${user.email})`,
        ip
      );

      return sendTokenCookie(user, 200, res);
    }

    // 2. User does not exist -> Self registration check
    const allowSelfReg = await systemSettingsRepository.getSetting('allow_self_registration', 'true');
    if (allowSelfReg !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'Public self-registration is currently disabled. Please contact your administrator.'
      });
    }

    // Check if extra registration details were provided in request body
    const { register_number, department, semester, name } = req.body;

    if (!register_number || !department || !semester) {
      // Prompt user on frontend to fill in required department, semester, and register number
      return res.status(200).json({
        success: true,
        requiresDetails: true,
        googleUser: {
          name: googleUser.name || '',
          email: googleUser.email
        },
        message: 'Please complete your student profile details to finalize registration.'
      });
    }

    const randomPasswordHash = await hashPassword(crypto.randomBytes(16).toString('hex'));

    user = await userRepository.createUser({
      name: (name || googleUser.name || googleUser.email.split('@')[0]).trim(),
      register_number: register_number.trim(),
      email: googleUser.email,
      password_hash: randomPasswordHash,
      role: 'student',
      department: department.trim(),
      semester: parseInt(semester, 10),
      is_approved: false
    });

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      user.id,
      'GOOGLE_REGISTER_REQUEST',
      `New Google user registered with details: ${user.name} (${user.register_number}, ${user.department}, Sem ${user.semester}). Pending approval.`,
      ip
    );

    return sendTokenCookie(user, 201, res);

  } catch (error) {
    console.error('googleAuth controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error authenticating with Google.'
    });
  }
};

module.exports = {
  register,
  login,
  googleAuth,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
  getRegistrationStatus,
  updateProfile,
  sendOtp,
  verifyOtpLogin,
  verifyOtpResetPassword,
  logError
};
