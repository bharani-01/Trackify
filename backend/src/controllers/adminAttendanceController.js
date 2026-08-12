const db = require('../config/db');
const auditLogRepository = require('../repositories/auditLogRepository');

/**
 * Get comprehensive attendance records with advanced filtering, sorting, and grouping for Admin
 */
const getAllStudentAttendance = async (req, res) => {
  try {
    const {
      search,
      department,
      semester,
      startDate,
      endDate,
      subjectId,
      status,
      conflictFilter,
      sortBy = 'date',
      sortOrder = 'DESC',
      limit = 500,
      offset = 0
    } = req.query;

    let query = `
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
        s.id AS subject_id,
        h.name AS holiday_name,
        h.created_at AS holiday_created_at,
        CASE 
          WHEN h.id IS NOT NULL THEN TRUE
          ELSE FALSE
        END AS is_holiday_conflict,
        CASE 
          WHEN h.id IS NOT NULL AND a.created_at < h.created_at THEN 'Pre-Marked Before Holiday'
          WHEN h.id IS NOT NULL THEN 'Marked On Holiday'
          ELSE 'Normal'
        END AS conflict_type
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      JOIN subjects s ON a.subject_id = s.id
      LEFT JOIN holidays h ON a.date = h.date 
                          AND (h.department IS NULL OR h.department = u.department)
                          AND (h.semester IS NULL OR h.semester = u.semester)
      WHERE 1=1
    `;

    const params = [];

    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      query += ` AND (
        u.name ILIKE $${params.length} 
        OR u.register_number ILIKE $${params.length} 
        OR u.email ILIKE $${params.length} 
        OR COALESCE(s.subject_name, s.name) ILIKE $${params.length} 
        OR COALESCE(s.subject_code, s.code) ILIKE $${params.length}
        OR h.name ILIKE $${params.length}
      )`;
    }

    if (department && department !== 'all') {
      params.push(department);
      query += ` AND u.department = $${params.length}`;
    }

    if (semester && semester !== 'all') {
      params.push(parseInt(semester, 10));
      query += ` AND u.semester = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      query += ` AND a.date >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND a.date <= $${params.length}`;
    }

    if (subjectId && subjectId !== 'all') {
      params.push(subjectId);
      query += ` AND a.subject_id = $${params.length}`;
    }

    if (status && status !== 'all') {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    if (conflictFilter && conflictFilter !== 'all') {
      if (conflictFilter === 'conflicts_only') {
        query += ` AND h.id IS NOT NULL`;
      } else if (conflictFilter === 'premarked_only') {
        query += ` AND h.id IS NOT NULL AND a.created_at < h.created_at`;
      } else if (conflictFilter === 'on_holiday_only') {
        query += ` AND h.id IS NOT NULL AND a.created_at >= h.created_at`;
      }
    }

    // Dynamic sorting
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    let orderByClause = `ORDER BY a.date ${order}, u.name ASC, a.created_at DESC`;

    if (sortBy === 'student') {
      orderByClause = `ORDER BY u.name ${order}, a.date DESC`;
    } else if (sortBy === 'subject') {
      orderByClause = `ORDER BY COALESCE(s.subject_name, s.name) ${order}, a.date DESC`;
    } else if (sortBy === 'status') {
      orderByClause = `ORDER BY a.status ${order}, a.date DESC`;
    }

    query += ` ${orderByClause} LIMIT ${parseInt(limit, 10)} OFFSET ${parseInt(offset, 10)}`;

    const result = await db.query(query, params);
    const records = result.rows;

    // Aggregate summary statistics
    const statsQuery = `
      SELECT 
        COUNT(*)::int AS total_records,
        SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::int AS total_present,
        SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END)::int AS total_absent,
        SUM(CASE WHEN a.status = 'On Duty' THEN 1 ELSE 0 END)::int AS total_od,
        SUM(CASE WHEN a.status = 'Medical Leave' THEN 1 ELSE 0 END)::int AS total_medical,
        SUM(CASE WHEN h.id IS NOT NULL THEN 1 ELSE 0 END)::int AS total_conflicts
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN holidays h ON a.date = h.date 
                          AND (h.department IS NULL OR h.department = u.department)
                          AND (h.semester IS NULL OR h.semester = u.semester)
    `;
    const statsResult = await db.query(statsQuery);
    const summaryStats = statsResult.rows[0];

    // Fetch list of active departments for filters
    const deptResult = await db.query('SELECT * FROM departments ORDER BY name ASC');

    return res.status(200).json({
      success: true,
      records,
      summaryStats,
      departments: deptResult.rows
    });
  } catch (error) {
    console.error('getAllStudentAttendance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance records'
    });
  }
};

/**
 * Flexible Targeted Clear Attendance endpoint for Admin
 * Allows clearing by Date, Student (userId), Subject, Department, Semester, or any combination!
 */
const targetedClearAttendance = async (req, res) => {
  try {
    const { date, userId, subjectId, department, semester, isHolidayConflictOnly } = req.body;

    if (!date && !userId && !subjectId && !department && !semester && !isHolidayConflictOnly) {
      return res.status(400).json({
        success: false,
        message: 'Please specify at least one filter criterion (e.g. date, student, department, or conflict type) to clear'
      });
    }

    let deleteQuery = `
      DELETE FROM attendance
      WHERE id IN (
        SELECT a.id
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN holidays h ON a.date = h.date 
                            AND (h.department IS NULL OR h.department = u.department)
                            AND (h.semester IS NULL OR h.semester = u.semester)
        WHERE 1=1
    `;

    const params = [];

    if (date) {
      params.push(date);
      deleteQuery += ` AND a.date = $${params.length}`;
    }

    if (userId) {
      params.push(userId);
      deleteQuery += ` AND a.user_id = $${params.length}`;
    }

    if (subjectId) {
      params.push(subjectId);
      deleteQuery += ` AND a.subject_id = $${params.length}`;
    }

    if (department) {
      params.push(department);
      deleteQuery += ` AND u.department = $${params.length}`;
    }

    if (semester) {
      params.push(parseInt(semester, 10));
      deleteQuery += ` AND u.semester = $${params.length}`;
    }

    if (isHolidayConflictOnly) {
      deleteQuery += ` AND h.id IS NOT NULL`;
    }

    deleteQuery += `) RETURNING id`;

    const deleteResult = await db.query(deleteQuery, params);
    const deletedCount = deleteResult.rowCount;

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const descParts = [];
    if (date) descParts.push(`Date: ${date}`);
    if (userId) descParts.push(`Student ID: ${userId}`);
    if (department) descParts.push(`Dept: ${department}`);
    if (semester) descParts.push(`Sem: ${semester}`);
    if (isHolidayConflictOnly) descParts.push(`Target: Holiday Conflicts Only`);

    await auditLogRepository.logAction(
      req.user.id,
      'CLEAR_ATTENDANCE_ADMIN',
      `Admin targeted clear attendance: removed ${deletedCount} entries (${descParts.join(', ') || 'Global'})`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: `Successfully cleared ${deletedCount} attendance record(s)`,
      count: deletedCount
    });
  } catch (error) {
    console.error('targetedClearAttendance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear target attendance records'
    });
  }
};

/**
 * Update / Edit a student attendance status or remarks as Admin
 */
const updateStudentAttendanceAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const query = `
      UPDATE attendance
      SET status = $1, remarks = $2
      WHERE id = $3
      RETURNING *
    `;
    const result = await db.query(query, [status, remarks ? remarks.trim() : null, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'UPDATE_ATTENDANCE_ADMIN',
      `Admin updated attendance record ID ${id}: status changed to ${status}`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: 'Attendance record updated successfully',
      record: result.rows[0]
    });
  } catch (error) {
    console.error('updateStudentAttendanceAdmin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update attendance record'
    });
  }
};

/**
 * Delete single attendance record by ID as Admin
 */
const deleteStudentAttendanceAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM attendance WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'DELETE_ATTENDANCE_ADMIN',
      `Admin deleted attendance record ID ${id}`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    console.error('deleteStudentAttendanceAdmin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete attendance record'
    });
  }
};

module.exports = {
  getAllStudentAttendance,
  targetedClearAttendance,
  updateStudentAttendanceAdmin,
  deleteStudentAttendanceAdmin
};
