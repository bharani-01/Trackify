const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: false
});

const CORE_TABLES = [
  'users',
  'departments',
  'subjects',
  'timetable',
  'attendance',
  'settings',
  'holidays',
  'timetable_adjustments'
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
    for (const table of CORE_TABLES) {
      const res = await pool.query(`SELECT * FROM ${table}`);
      backupData.tables[table] = res.rows;
      console.log(`Backed up table: ${table} (${res.rows.length} rows)`);
    }

    const backupFilePath = path.join(backupDir, `trackify_core_backup_${timestamp}.json`);
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
    console.log(`\nCore database backup written successfully to: ${backupFilePath}`);

  } catch (err) {
    console.error('Backup error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

takeBackup();
