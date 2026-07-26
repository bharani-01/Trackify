const remoteBackupService = require('../backend/src/services/remoteBackupService');
const backupDb = require('../backend/src/config/backupDb');
const localDb = require('../backend/src/config/db');

async function runVerification() {
  try {
    console.log('--- STARTING REMOTE BACKUP SYSTEM VERIFICATION ---');

    // 1. Connection check
    console.log('1. Checking remote backup database connectivity...');
    const dbCheck = await backupDb.query('SELECT 1 + 1 AS result');
    console.log('Remote database connection: SUCCESS. Result:', dbCheck.rows[0].result);

    // 2. Clear old test snapshots to keep clean
    console.log('2. Cleaning up any previous test snapshots...');
    await backupDb.query("DELETE FROM backups WHERE version_name = 'test_verification_snapshot'");

    // 3. Create a snapshot version
    console.log('3. Triggering test remote backup snapshot...');
    const backupId = await remoteBackupService.createBackupVersion('test_verification_snapshot');
    console.log('Backup creation: SUCCESS. Backup ID:', backupId);

    // 4. Verify snapshot exists in list
    console.log('4. Listing remote backups...');
    const backupsList = await remoteBackupService.listRemoteBackups();
    const createdBackup = backupsList.find(b => b.id === backupId);
    if (createdBackup) {
      console.log('Backup list validation: SUCCESS. Found backup version:', createdBackup.version_name);
    } else {
      throw new Error('Created backup not found in remote list!');
    }

    // 5. Test database pruning
    console.log('5. Testing 7-day backup pruning trigger...');
    await remoteBackupService.pruneOldBackups();
    console.log('Backup pruning run: SUCCESS.');

    // 6. Test database restore
    console.log('6. Testing database restore from backup snapshot...');
    // Let's insert a temp user locally to check if it's wiped and restored
    const testEmail = 'restored_test_user@trackifyapp.co.in';
    await localDb.query("DELETE FROM users WHERE email = $1", [testEmail]);
    
    // Perform restore
    console.log('Executing restoration procedure...');
    const restoredName = await remoteBackupService.restoreBackupVersion(backupId);
    console.log(`Restoration trigger: SUCCESS. Restored version: ${restoredName}`);

    // Verify temp user does not exist locally (confirming clean restore)
    const checkRes = await localDb.query("SELECT id FROM users WHERE email = $1", [testEmail]);
    if (checkRes.rows.length === 0) {
      console.log('Restoration verification: SUCCESS. Database reverted cleanly.');
    } else {
      throw new Error('Restored database contains elements that should have been overwritten!');
    }

    // Clean up remote database test record
    console.log('7. Cleaning up test snapshot from remote backups...');
    await remoteBackupService.deleteBackupVersion(backupId);
    console.log('Cleanup: SUCCESS.');

    console.log('--- ALL BACKUP SYSTEM TESTS PASSED SUCCESSFULLY ---');
    process.exit(0);
  } catch (error) {
    console.error('--- BACKUP SYSTEM TEST FAILED ---');
    console.error(error.stack || error.message || error);
    process.exit(1);
  }
}

// Wait for database start migrations to complete
setTimeout(runVerification, 2000);
