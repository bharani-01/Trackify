const localDb = require('../config/db');
const backupDb = require('../config/backupDb');

const TABLES_TO_BACKUP = [
  'departments',
  'users',
  'subjects',
  'timetable',
  'attendance',
  'settings',
  'system_settings',
  'holidays',
  'schedule_adjustments'
];

const getLocalTableColumns = async (tableName) => {
  const res = await localDb.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = $1 AND table_schema = 'public'
  `, [tableName]);
  return res.rows.map(r => r.column_name);
};

const batchInsert = async (client, table, columns, rows) => {
  if (rows.length === 0) return;
  const chunkSize = Math.floor(60000 / columns.length);
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const valuePlaceholders = [];
    const flatValues = [];
    let paramIndex = 1;

    for (const row of chunk) {
      const rowPlaceholders = [];
      for (const col of columns) {
        flatValues.push(row[col]);
        rowPlaceholders.push(`$${paramIndex}`);
        paramIndex++;
      }
      valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${valuePlaceholders.join(', ')}`;
    await client.query(query, flatValues);
  }
};

/**
 * Creates a structured snapshot backup version in the remote database
 * @param {string} versionName 
 * @returns {Promise<string>} The created backup version UUID
 */
const createBackupVersion = async (versionName) => {
  if (!backupDb.pool) {
    throw new Error('Remote backup database is not configured.');
  }

  const remoteClient = await backupDb.pool.connect();
  try {
    await remoteClient.query('BEGIN');

    // 1. Insert snapshot log record
    const backupRes = await remoteClient.query(
      'INSERT INTO backups (version_name) VALUES ($1) RETURNING id',
      [versionName]
    );
    const backupId = backupRes.rows[0].id;

    // 2. Fetch and replicate data for each table
    for (const table of TABLES_TO_BACKUP) {
      const localData = await localDb.query(`SELECT * FROM ${table}`);
      if (localData.rows.length === 0) continue;

      const columns = Object.keys(localData.rows[0]);
      const insertColumns = ['backup_id', ...columns];
      const mappedRows = localData.rows.map(row => ({
        backup_id: backupId,
        ...row
      }));

      await batchInsert(remoteClient, `backup_${table}`, insertColumns, mappedRows);
    }

    await remoteClient.query('COMMIT');
    
    // Automatically trigger pruning to enforce 7-day retention
    await pruneOldBackupsInternal(remoteClient);

    return backupId;
  } catch (error) {
    await remoteClient.query('ROLLBACK');
    console.error('[REMOTE BACKUP SERVICE ERROR]: Failed to create backup:', error.message);
    throw error;
  } finally {
    remoteClient.release();
  }
};

/**
 * Prunes backup versions older than 7 days
 */
const pruneOldBackups = async () => {
  if (!backupDb.pool) return;
  const remoteClient = await backupDb.pool.connect();
  try {
    await pruneOldBackupsInternal(remoteClient);
  } finally {
    remoteClient.release();
  }
};

const pruneOldBackupsInternal = async (client) => {
  const query = "DELETE FROM backups WHERE created_at < NOW() - INTERVAL '7 days'";
  const res = await client.query(query);
  if (res.rowCount > 0) {
    console.log(`[REMOTE BACKUP SERVICE]: Pruned ${res.rowCount} backup versions older than 7 days.`);
  }
};

/**
 * Restores local database state from a remote backup version
 * @param {string} backupId 
 */
const restoreBackupVersion = async (backupId) => {
  if (!backupDb.pool) {
    throw new Error('Remote backup database is not configured.');
  }

  // 1. Verify backup exists on remote
  const verifyRes = await backupDb.query('SELECT version_name FROM backups WHERE id = $1', [backupId]);
  if (verifyRes.rows.length === 0) {
    throw new Error('Requested backup version not found.');
  }
  const versionName = verifyRes.rows[0].version_name;

  console.log(`[REMOTE BACKUP SERVICE]: Initiating restore for version: ${versionName} (${backupId})`);

  // 2. Perform restoration on local DB in a session-replication transaction
  const localClient = await localDb.pool.connect();
  try {
    await localClient.query('BEGIN');
    await localClient.query("SET session_replication_role = 'replica'");

    // Truncate local tables
    for (const table of TABLES_TO_BACKUP) {
      await localClient.query(`TRUNCATE TABLE ${table} CASCADE`);
    }

    // Retrieve and insert data from remote database
    for (const table of TABLES_TO_BACKUP) {
      const remoteData = await backupDb.query(`SELECT * FROM backup_${table} WHERE backup_id = $1`, [backupId]);
      if (remoteData.rows.length === 0) continue;

      const localCols = await getLocalTableColumns(table);
      const firstRow = remoteData.rows[0];
      const columns = localCols.filter(col => col !== 'backup_id' && firstRow.hasOwnProperty(col));

      await batchInsert(localClient, table, columns, remoteData.rows);
    }

    await localClient.query("SET session_replication_role = 'origin'");
    await localClient.query('COMMIT');
    console.log(`[REMOTE BACKUP SERVICE]: Restoration complete for version: ${versionName}`);
    return versionName;
  } catch (error) {
    await localClient.query('ROLLBACK');
    console.error('[REMOTE BACKUP SERVICE RESTORE ERROR]: Restoring database state failed:', error.message);
    throw error;
  } finally {
    localClient.release();
  }
};

/**
 * Lists all remote backups
 */
const listRemoteBackups = async () => {
  if (!backupDb.pool) return [];
  const res = await backupDb.query('SELECT id, version_name, created_at FROM backups ORDER BY created_at DESC');
  return res.rows;
};

/**
 * Deletes a remote backup snapshot
 * @param {string} backupId 
 */
const deleteBackupVersion = async (backupId) => {
  if (!backupDb.pool) {
    throw new Error('Remote backup database is not configured.');
  }
  await backupDb.query('DELETE FROM backups WHERE id = $1', [backupId]);
};

module.exports = {
  createBackupVersion,
  pruneOldBackups,
  restoreBackupVersion,
  listRemoteBackups,
  deleteBackupVersion
};
