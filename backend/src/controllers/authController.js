const userRepository = require('../repositories/userRepository');
const { hashPassword, comparePassword, generateToken } = require('../utils/authHelper');

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
    // 1. Validation
    if (!name || !register_number || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, register number, email, and password'
      });
    }

    // 2. Check if user already exists (by email)
    const userExistsByEmail = await userRepository.findByEmail(email);
    if (userExistsByEmail) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    // 3. Hash password
    const password_hash = await hashPassword(password);

    // 4. Create user
    const newUser = await userRepository.createUser({
      name,
      register_number,
      email,
      password_hash,
      role: 'student', // Default role is student. Admins are seeded.
      department,
      semester: semester ? parseInt(semester, 10) : null
    });

    // 5. Send cookie & response
    sendTokenCookie(newUser, 201, res);
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

    // 3. Compare passwords
    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // 4. Send cookie & response
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
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 5000), // Expires in 5 seconds
      httpOnly: true
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

module.exports = {
  register,
  login,
  getMe,
  logout
};
