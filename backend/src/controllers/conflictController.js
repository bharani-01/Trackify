const db = require('../config/db');
const auditLogRepository = require('../repositories/auditLogRepository');

/**
 * Get all holiday attendance conflicts and holiday audit events for Admin
 */
const getAdminConflicts = async (req, res) => {
  try {
    // 1. Fetch active attendance conflicts (attendance logs matching holiday dates)
    const activeConflictsQuery = `
      SELECT 
        a.id AS attendance_id,
        a.date,
        a.status,
        a.remarks,
        a.created_at AS marked_at,
        u.id AS user_id,
        u.name AS student_name,
        u.email AS student_email,
        u.register_number,
        u.department,
        u.semester,
        COALESCE(s.subject_name, s.name) AS subject_name,
        COALESCE(s.subject_code, s.code) AS subject_code,
        h.name AS holiday_name,
        h.created_at AS holiday_created_at,
        CASE 
          WHEN a.created_at < h.created_at THEN 'Pre-Marked Before Holiday'
          ELSE 'Marked On Holiday'
        END AS conflict_type
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      JOIN holidays h ON a.date = h.date 
                     AND (h.department IS NULL OR h.department = u.department)
                     AND (h.semester IS NULL OR h.semester = u.semester)
      LEFT JOIN subjects s ON a.subject_id = s.id
      ORDER BY a.date DESC, a.created_at DESC
    `;
    const activeResult = await db.query(activeConflictsQuery);
    const activeConflicts = activeResult.rows;

    // 2. Compute conflict statistics
    const activeCount = activeConflicts.length;
    const preMarkedCount = activeConflicts.filter(c => c.conflict_type === 'Pre-Marked Before Holiday').length;
    const uniqueStudents = new Set(activeConflicts.map(c => c.user_id)).size;

    // 3. Fetch recent holiday audit events (attempts blocked, records cleared, holidays created)
    const auditQuery = `
      SELECT al.*, COALESCE(u.name, 'System') AS user_name, u.email AS user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.action IN ('CLEAR_ATTENDANCE', 'MARK_ATTENDANCE', 'UPDATE_ATTENDANCE', 'CREATE_HOLIDAY', 'DELETE_ATTENDANCE', 'RESOLVE_HOLIDAY_CONFLICTS')
        AND (
          al.details ILIKE '%holiday%' 
          OR al.details ILIKE '%cleared%' 
          OR al.details ILIKE '%conflict%'
        )
      ORDER BY al.created_at DESC
      LIMIT 100
    `;
    const auditResult = await db.query(auditQuery);
    const auditEvents = auditResult.rows;

    return res.status(200).json({
      success: true,
      activeConflicts,
      auditEvents,
      stats: {
        activeCount,
        preMarkedCount,
        uniqueStudents,
        totalAuditEvents: auditEvents.length
      }
    });
  } catch (error) {
    console.error('getAdminConflicts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance conflicts'
    });
  }
};

/**
 * Resolve / Purge all active holiday attendance conflicts
 */
const resolveAllConflicts = async (req, res) => {
  try {
    const purgeQuery = `
      DELETE FROM attendance
      WHERE id IN (
        SELECT a.id
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        JOIN holidays h ON a.date = h.date 
                       AND (h.department IS NULL OR h.department = u.department)
                       AND (h.semester IS NULL OR h.semester = u.semester)
      )
      RETURNING id
    `;
    const purgeResult = await db.query(purgeQuery);
    const count = purgeResult.rowCount;

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'RESOLVE_HOLIDAY_CONFLICTS',
      `Auto-purged ${count} holiday attendance conflict records across all cohorts`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: `Successfully resolved and purged ${count} holiday attendance conflict(s)`,
      count
    });
  } catch (error) {
    console.error('resolveAllConflicts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resolve holiday attendance conflicts'
    });
  }
};

/**
 * Delete a specific conflicting attendance record by ID
 */
const deleteSingleConflict = async (req, res) => {
  try {
    const { id } = req.params;
    const deleteQuery = 'DELETE FROM attendance WHERE id = $1 RETURNING *';
    const result = await db.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conflict record not found'
      });
    }

    const deletedRecord = result.rows[0];

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'DELETE_ATTENDANCE',
      `Manually resolved conflict: deleted attendance ID ${id} for Date ${deletedRecord.date}`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: 'Conflict record resolved successfully'
    });
  } catch (error) {
    console.error('deleteSingleConflict error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete conflict record'
    });
  }
};

module.exports = {
  getAdminConflicts,
  resolveAllConflicts,
  deleteSingleConflict
};
