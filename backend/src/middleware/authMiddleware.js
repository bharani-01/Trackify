const { verifyToken } = require('../utils/authHelper');
const userRepository = require('../repositories/userRepository');

/**
 * Middleware to check JWT authentication from HttpOnly cookies or Authorization header
 */
const protect = async (req, res, next) => {
  let token;

  // 1. Check cookies first (standard for our frontend client)
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Fallback to Authorization Header (Bearer token)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided'
    });
  }

  try {
    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token verification failed'
      });
    }

    // Fetch user from DB to make sure user still exists and check their active data
    const user = await userRepository.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user no longer exists'
      });
    }

    if (user.is_suspended) {
      res.clearCookie('token');
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended by an administrator.'
      });
    }

    // Attach user context to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Not authorized, session error'
    });
  }
};

/**
 * Middleware to restrict access to specific roles (e.g., 'admin')
 * @param {...string} roles 
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: User role '${req.user ? req.user.role : 'none'}' is not authorized to access this resource`
      });
    }
    next();
  };
};

module.exports = {
  protect,
  authorize
};
