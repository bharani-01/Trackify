const jwt = require('jsonwebtoken');
const auditLogRepository = require('../repositories/auditLogRepository');

/**
 * Global Express Middleware to monitor and audit log every incoming /api/* HTTP call
 */
const apiAuditLogger = (req, res, next) => {
  // Exclude audit log fetch requests to prevent recursive audit loops
  if (req.originalUrl && req.originalUrl.startsWith('/api/admin/audit-logs')) {
    return next();
  }

  const startTime = Date.now();
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || '';

  // Capture completion when response finishes
  res.on('finish', async () => {
    try {
      const responseTime = Date.now() - startTime;
      const statusCode = res.statusCode;
      const method = req.method;
      const path = req.originalUrl || req.url;

      // Extract User ID if available from req.user or JWT token cookie
      let userId = req.user ? req.user.id : null;
      let userEmail = req.user ? req.user.email : null;

      if (!userId && req.cookies && req.cookies.token && process.env.JWT_SECRET) {
        try {
          const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
          userId = decoded.id;
          userEmail = decoded.email;
        } catch (e) {
          // Token verification failed or expired - leave as anonymous
        }
      }

      // Determine action label (e.g. "API_GET", "API_POST", "API_ALERT_404", "API_ALERT_500")
      let actionName = `API_${method}`;
      if (statusCode >= 400) {
        actionName = `API_ALERT_${statusCode}`;
      }

      const userTag = userEmail ? ` (${userEmail})` : ' (Guest/Anonymous)';
      const details = `${method} ${path} -> Status ${statusCode} [${responseTime}ms]${userTag}`;

      // Log API activity asynchronously
      await auditLogRepository.logAction(userId, actionName, details, ip, userAgent);
    } catch (err) {
      console.error('[API AUDIT LOGGER ERROR]:', err.message);
    }
  });

  next();
};

module.exports = apiAuditLogger;
