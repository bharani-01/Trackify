const { pool } = require('../backend/src/config/db');
const pushService = require('../backend/src/services/pushNotificationService');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verify() {
  console.log('🔍 Running final verification for Firebase Web Push integration...');
  // Wait 3 seconds to let async db migrations finish running
  console.log('⏳ Waiting for migrations to complete...');
  await sleep(3000);
  
  try {
    // 1. Check if user_device_tokens table exists and has correct columns
    const tableCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_device_tokens'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.error('❌ Table user_device_tokens was not created!');
    } else {
      console.log('✅ Table user_device_tokens exists. Columns:');
      tableCheck.rows.forEach(c => {
        console.log(`   - ${c.column_name} (${c.data_type})`);
      });
    }

    // 2. Check if push service is loaded correctly
    if (typeof pushService.sendPush === 'function') {
      console.log('✅ pushNotificationService.sendPush is a valid function.');
    } else {
      console.error('❌ pushNotificationService.sendPush is missing!');
    }

    // 3. Test push notification mockup delivery
    console.log('⏳ Testing mocked multicast push dispatch...');
    const testIds = ['00000000-0000-0000-0000-000000000000'];
    
    const result = await pushService.sendPush(testIds, 'Verification Title', 'Verification Body content');
    console.log('✅ Push dispatch call executed. Success count:', result.successCount);

  } catch (error) {
    console.error('❌ Verification script encountered an error:', error);
  } finally {
    await pool.end();
    console.log('🏁 Verification completed.');
  }
}

verify();
