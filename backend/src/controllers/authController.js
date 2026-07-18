const crypto = require('crypto');
const userRepository = require('../repositories/userRepository');
const systemSettingsRepository = require('../repositories/systemSettingsRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const { hashPassword, comparePassword, generateToken } = require('../utils/authHelper');
const { sendResetEmail } = require('../utils/emailHelper');

/**
 * Helper to set JWT token cookie in response
 */
const sendTokenCookie = (user, statusCode, res) => {
  const token = generateToken({ id: user.id, role: user.role, email: user.email });

  const cookieExpireDays = parseInt(process.env.COOKIE_EXPIRE || '1', 10);
  const cookieOptions = {
    expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  };

  // Determine redirection target based on role
  const redirectUrl = user.role === 'admin' ? '/admin/dashboard' : '/student/dashboard';

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      token, // Include token in body to simplify mobile app authorization headers
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        register_number: user.register_number,
        department: user.department,
        semester: user.semester
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

    return res.status(201).json({
      success: true,
      message: 'Your registration request has been submitted successfully! An administrator will review and approve your account shortly.'
    });
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
    // 1. Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // 2. Fetch user
    const user = await userRepository.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (user.is_suspended) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended by an administrator.'
      });
    }

    if (!user.is_approved) {
      return res.status(403).json({
        success: false,
        message: 'Your registration request is pending administrator approval.'
      });
    }

    // 3. Compare passwords
    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // 4. Send cookie & response
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(user.id, 'LOGIN', `User logged in: ${user.name} (${user.email})`, ip);
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
      allowSelfRegistration: allowSelfReg === 'true'
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

module.exports = {
  register,
  login,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
  getRegistrationStatus,
  updateProfile
};
