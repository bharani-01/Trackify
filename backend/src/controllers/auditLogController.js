const auditLogRepository = require('../repositories/auditLogRepository');

/**
 * Handle HTTP request to retrieve paginated system activity audit logs
 */
const getAuditLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 30;
    const offset = parseInt(req.query.offset, 10) || 0;
    const search = req.query.search || '';
    const actionFilter = req.query.action || 'all';
    const deviceFilter = req.query.device || 'all';
    const sortOrder = req.query.order || 'DESC';

    const { logs, total, stats } = await auditLogRepository.getAuditLogs(limit, offset, search, actionFilter, deviceFilter, sortOrder);

    return res.status(200).json({
      success: true,
      logs,
      stats,
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

const getClientErrors = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const showResolved = req.query.showResolved === 'true';

    const { logs, total } = await auditLogRepository.getClientErrors(limit, offset, showResolved);

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
    console.error('getClientErrors controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve client error logs'
    });
  }
};

const resolveClientError = async (req, res) => {
  try {
    const { id } = req.params;
    const resolvedLog = await auditLogRepository.resolveClientError(id);
    if (!resolvedLog) {
      return res.status(404).json({ success: false, message: 'Client error log not found or already resolved' });
    }
    return res.status(200).json({ success: true, log: resolvedLog });
  } catch (error) {
    console.error('resolveClientError controller error:', error);
    return res.status(500).json({ success: false, message: 'Failed to resolve client error log' });
  }
};

module.exports = {
  getAuditLogs,
  getClientErrors,
  resolveClientError
};
