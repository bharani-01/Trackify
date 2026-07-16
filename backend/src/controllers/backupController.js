const backupRepository = require('../repositories/backupRepository');
const backupHelper = require('../utils/backupHelper');

/**
 * Helper to generate a timestamped filename
 */
const getTimestampedFilename = (prefix, extension) => {
  const now = new Date();
  const dateStr = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
  return `${prefix}_${dateStr}.${extension}`;
};

/**
 * Trigger background database backup, email SQL dump, and log result
 * @route POST /api/admin/backups
 */
const triggerBackup = async (req, res) => {
  const { email } = req.body;
  const filename = getTimestampedFilename('trackify_backup_complete', 'sql');
  const recipientEmail = email || (req.user ? req.user.email : 'admin@trackify.com');

  try {
    // 1. Generate full SQL dump
    const sqlDump = await backupHelper.generateSqlDump();

    // 2. Dispatch email attachment via Resend
    await backupHelper.sendBackupEmail(
      recipientEmail,
      `Trackify Database Backup - ${filename}`,
      filename,
      sqlDump
    );

    // 3. Log success
    const log = await backupRepository.logBackup(filename, 'Success');

    return res.status(200).json({
      success: true,
      message: `Complete database backup generated and sent to ${recipientEmail} successfully.`,
      log
    });
  } catch (error) {
    console.error('triggerBackup error:', error);
    
    // Log failure
    const log = await backupRepository.logBackup(filename, 'Failed', error.message);

    return res.status(500).json({
      success: false,
      message: `Failed to complete backup: ${error.message}`,
      log
    });
  }
};

/**
 * Retrieve past backups history logs
 * @route GET /api/admin/backups
 */
const getBackupsList = async (req, res) => {
  try {
    const logs = await backupRepository.getBackupLogs();
    return res.status(200).json({
      success: true,
      backups: logs
    });
  } catch (error) {
    console.error('getBackupsList error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving backup logs.'
    });
  }
};

/**
 * Stream file downloads directly in the browser (SQL or CSV formats)
 * @route GET /api/admin/backups/export
 */
const exportData = async (req, res) => {
  const { format } = req.query;

  try {
    if (format === 'sql') {
      const sqlDump = await backupHelper.generateSqlDump();
      const filename = getTimestampedFilename('trackify_complete_db', 'sql');
      
      res.setHeader('Content-Type', 'text/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(sqlDump);
    } 
    
    if (format === 'csv_attendance') {
      const csvData = await backupHelper.generateAttendanceCsv();
      const filename = getTimestampedFilename('trackify_attendance_records', 'csv');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvData);
    }

    if (format === 'csv_students') {
      const csvData = await backupHelper.generateStudentDirectoryCsv();
      const filename = getTimestampedFilename('trackify_students_directory', 'csv');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvData);
    }

    return res.status(400).json({
      success: false,
      message: 'Invalid export format. Choose "sql", "csv_attendance", or "csv_students".'
    });
  } catch (error) {
    console.error('exportData error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating export file.'
    });
  }
};

/**
 * Dispatch specific files via email to the administrator on demand
 * @route POST /api/admin/backups/email
 */
const emailData = async (req, res) => {
  const { format, email } = req.body;
  const recipientEmail = email || (req.user ? req.user.email : 'admin@trackify.com');

  try {
    let content = '';
    let filename = '';
    let subject = '';

    if (format === 'sql') {
      content = await backupHelper.generateSqlDump();
      filename = getTimestampedFilename('trackify_complete_db', 'sql');
      subject = `On-Demand SQL Backup - ${filename}`;
    } else if (format === 'csv_attendance') {
      content = await backupHelper.generateAttendanceCsv();
      filename = getTimestampedFilename('trackify_attendance_records', 'csv');
      subject = `On-Demand Attendance CSV Export - ${filename}`;
    } else if (format === 'csv_students') {
      content = await backupHelper.generateStudentDirectoryCsv();
      filename = getTimestampedFilename('trackify_students_directory', 'csv');
      subject = `On-Demand Students CSV Export - ${filename}`;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid format requested.'
      });
    }

    await backupHelper.sendBackupEmail(recipientEmail, subject, filename, content);
    
    // Log a database entry for SQL backups
    if (format === 'sql') {
      await backupRepository.logBackup(filename, 'Success');
    }

    return res.status(200).json({
      success: true,
      message: `File ${filename} has been emailed to ${recipientEmail} successfully.`
    });
  } catch (error) {
    console.error('emailData error:', error);
    if (format === 'sql') {
      await backupRepository.logBackup(getTimestampedFilename('trackify_complete_db', 'sql'), 'Failed', error.message);
    }
    return res.status(500).json({
      success: false,
      message: `Failed to email file: ${error.message}`
    });
  }
};

module.exports = {
  triggerBackup,
  getBackupsList,
  exportData,
  emailData
};
