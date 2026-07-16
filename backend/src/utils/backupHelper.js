const { Resend } = require('resend');
const db = require('../config/db');

/**
 * Generate a complete database SQL insertion dump
 * Preserves all active data and uses ON CONFLICT DO NOTHING
 */
const generateSqlDump = async () => {
  const tables = ['departments', 'users', 'subjects', 'timetable', 'attendance', 'settings', 'system_settings', 'notifications'];
  let sqlDump = `-- TRACKIFY COMPLETE DATABASE DUMP\n-- Generated on ${new Date().toISOString()}\n\n`;

  // Disable triggers to prevent foreign key ordering check blocks
  sqlDump += "SET session_replication_role = 'replica';\n\n";

  for (const table of tables) {
    sqlDump += `-- Dumping data for table ${table}\n`;
    
    // Get all records
    const res = await db.query(`SELECT * FROM ${table}`);
    
    if (res.rows.length === 0) {
      sqlDump += `-- Table ${table} is empty\n\n`;
      continue;
    }

    const columns = Object.keys(res.rows[0]);
    
    for (const row of res.rows) {
      const vals = columns.map(col => {
        const val = row[col];
        if (val === null) return 'NULL';
        if (typeof val === 'string') {
          return `'${val.replace(/'/g, "''")}'`;
        }
        if (val instanceof Date) {
          return `'${val.toISOString()}'`;
        }
        if (typeof val === 'object') {
          return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        }
        if (typeof val === 'boolean') {
          return val ? 'TRUE' : 'FALSE';
        }
        return val;
      });

      sqlDump += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT DO NOTHING;\n`;
    }
    sqlDump += '\n';
  }

  // Restore trigger check behavior
  sqlDump += "SET session_replication_role = 'origin';\n";

  return sqlDump;
};

/**
 * Generate a clean spreadsheet CSV format of the entire Attendance logs
 */
const generateAttendanceCsv = async () => {
  const query = `
    SELECT 
      u.name AS student_name,
      u.register_number,
      s.subject_code,
      s.subject_name,
      a.date::text,
      a.status,
      COALESCE(a.remarks, '') AS remarks
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    JOIN subjects s ON a.subject_id = s.id
    ORDER BY a.date DESC, u.name ASC
  `;
  const res = await db.query(query);
  
  const headers = ['Student Name', 'Registration Number', 'Subject Code', 'Subject Name', 'Date', 'Status', 'Remarks'];
  let csvContent = headers.join(',') + '\n';

  for (const row of res.rows) {
    const line = [
      `"${row.student_name.replace(/"/g, '""')}"`,
      `"${row.register_number.replace(/"/g, '""')}"`,
      `"${row.subject_code.replace(/"/g, '""')}"`,
      `"${row.subject_name.replace(/"/g, '""')}"`,
      `"${row.date.replace(/"/g, '""')}"`,
      `"${row.status.replace(/"/g, '""')}"`,
      `"${row.remarks.replace(/"/g, '""')}"`
    ];
    csvContent += line.join(',') + '\n';
  }

  return csvContent;
};

/**
 * Generate a clean spreadsheet CSV format of the Student directories roster
 */
const generateStudentDirectoryCsv = async () => {
  const query = `
    SELECT 
      name,
      email,
      register_number,
      COALESCE(department, 'N/A') AS department,
      COALESCE(semester::text, 'N/A') AS semester,
      CASE WHEN is_suspended THEN 'Suspended' ELSE 'Active' END AS status,
      created_at::text
    FROM users
    WHERE role = 'student'
    ORDER BY name ASC
  `;
  const res = await db.query(query);
  
  const headers = ['Full Name', 'Email Address', 'Registration Number', 'Department', 'Semester', 'Account Status', 'Date Created'];
  let csvContent = headers.join(',') + '\n';

  for (const row of res.rows) {
    const line = [
      `"${row.name.replace(/"/g, '""')}"`,
      `"${row.email.replace(/"/g, '""')}"`,
      `"${row.register_number.replace(/"/g, '""')}"`,
      `"${row.department.replace(/"/g, '""')}"`,
      `"${row.semester.replace(/"/g, '""')}"`,
      `"${row.status.replace(/"/g, '""')}"`,
      `"${row.created_at.replace(/"/g, '""')}"`
    ];
    csvContent += line.join(',') + '\n';
  }

  return csvContent;
};

/**
 * Dispatch backup attachments using Resend
 */
const sendBackupEmail = async (email, subject, filename, content) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error('Resend API key is not configured.');
  }

  const resend = new Resend(resendApiKey);

  try {
    const data = await resend.emails.send({
      from: 'Trackify <trackify@bharani-01.xyz>',
      to: [email],
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
          <h2 style="color: #0f172a; margin-bottom: 16px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Trackify Backup Delivery</h2>
          <p style="color: #475569; font-size: 16px; line-height: 24px;">An administrative data export request was successfully processed.</p>
          <p style="color: #475569; font-size: 16px; line-height: 24px;">Please find the requested file attachment: <strong>${filename}</strong>.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">Generated automatically by Trackify Database Diagnostics.</p>
        </div>
      `,
      attachments: [
        {
          filename: filename,
          content: Buffer.from(content).toString('base64')
        }
      ]
    });
    return data;
  } catch (error) {
    console.error('[BACKUP EMAIL ERROR]:', error);
    throw error;
  }
};

module.exports = {
  generateSqlDump,
  generateAttendanceCsv,
  generateStudentDirectoryCsv,
  sendBackupEmail
};
