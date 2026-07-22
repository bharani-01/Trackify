/**
 * Security Rate Limiter and Brute-Force Protection Middleware
 */

const rateStore = new Map();

// Periodic cleanup of expired rate limit entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateStore.entries()) {
    if (now > record.resetTime) {
      rateStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Custom Rate Limiter Factory
 * @param {object} options { windowMs, max, message }
 */
const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000; // Default 15 minutes
  const max = options.max || 10; // Default 10 requests per window
  const message = options.message || 'Too many requests, please try again later.';

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const key = `${req.baseUrl}${req.path}_${ip}`;
    const now = Date.now();

    let record = rateStore.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      rateStore.set(key, record);
    } else {
      record.count += 1;
    }

    // Set rate limit standard headers
    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(429).json({
        success: false,
        message,
        retryAfter: resetSeconds
      });
    }

    next();
  };
};

// Rate limiter instances for authentication endpoints
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
});

const otpRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many OTP verification attempts. Please wait 15 minutes before trying again.'
});

const apiRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120,
  message: 'Too many API requests. Please slow down.'
});

module.exports = {
  createRateLimiter,
  authRateLimiter,
  otpRateLimiter,
  apiRateLimiter
};
