const auditLogRepository = require('../repositories/auditLogRepository');

/**
 * Handle HTTP request to retrieve paginated system activity audit logs
 */
const getAuditLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const search = req.query.search || '';

    const { logs, total } = await auditLogRepository.getAuditLogs(limit, offset, search);

    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        total,
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('getAuditLogs controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve activity audit logs'
    });
  }
};

module.exports = {
  getAuditLogs
};
