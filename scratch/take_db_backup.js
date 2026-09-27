const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

const TABLES = [
  'users',
  'departments',
  'subjects',
  'timetable',
  'attendance',
  'settings',
  'holidays',
  'timetable_adjustments',
  'audit_logs'
];

async function takeBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupData = {
    timestamp: new Date().toISOString(),
    tables: {}
  };

  try {
    for (const table of TABLES) {
      try {
        const res = await pool.query(`SELECT * FROM ${table}`);
        backupData.tables[table] = res.rows;
        console.log(`Backed up table: ${table} (${res.rows.length} rows)`);
      } catch (tableErr) {
        console.warn(`Could not backup table ${table}:`, tableErr.message);
      }
    }

    const backupFilePath = path.join(backupDir, `trackify_full_backup_${timestamp}.json`);
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
    console.log(`\nFull database backup successfully written to: ${backupFilePath}`);

    // Specific backup for Sai Vidya M
    const saiRes = await pool.query(`
      SELECT a.*, s.subject_code, s.subject_name
      FROM attendance a
      JOIN subjects s ON a.subject_id = s.id
      JOIN users u ON a.user_id = u.id
      WHERE u.email = 'saividya2007@gmail.com' OR u.register_number = 'E0124054'
    `);
    const saiBackupPath = path.join(backupDir, `saividya_attendance_backup_${timestamp}.json`);
    fs.writeFileSync(saiBackupPath, JSON.stringify(saiRes.rows, null, 2));
    console.log(`Specific Sai Vidya M attendance backup written to: ${saiBackupPath} (${saiRes.rows.length} rows)`);

  } catch (err) {
    console.error('Backup failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

takeBackup();
