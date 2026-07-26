const systemSettingsRepository = require('../backend/src/repositories/systemSettingsRepository');

async function verify() {
  try {
    console.log('--- Initial Settings Retrieval ---');
    const mode = await systemSettingsRepository.getSetting('maintenance_mode', 'false');
    const bypass = await systemSettingsRepository.getSetting('maintenance_bypass_emails', '');
    console.log('maintenance_mode:', mode);
    console.log('maintenance_bypass_emails:', bypass);

    console.log('\n--- Setting maintenance_bypass_emails ---');
    await systemSettingsRepository.setSetting('maintenance_bypass_emails', 'test1@example.com,test2@example.com');
    const updatedBypass = await systemSettingsRepository.getSetting('maintenance_bypass_emails', '');
    console.log('Updated maintenance_bypass_emails:', updatedBypass);

    console.log('\n--- Resetting maintenance_bypass_emails ---');
    await systemSettingsRepository.setSetting('maintenance_bypass_emails', bypass);
    const finalBypass = await systemSettingsRepository.getSetting('maintenance_bypass_emails', '');
    console.log('Final maintenance_bypass_emails:', finalBypass);
    
    console.log('\nSUCCESS: Database settings verified successfully!');
    process.exit(0);
  } catch (error) {
    console.error('VERIFICATION FAILURE:', error);
    process.exit(1);
  }
}

verify();
