const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const dnsPromises = dns.promises;

async function checkDNS() {
  console.log('=== CHECKING DNS RECORDS FOR trackifyapp.co.in (via 8.8.8.8) ===\n');

  try {
    console.log('1. MX Records for "trackifyapp.co.in":');
    const rootMx = await dnsPromises.resolveMx('trackifyapp.co.in');
    console.log(rootMx);
  } catch (e) {
    console.log('   Error resolving MX for trackifyapp.co.in:', e.message);
  }

  try {
    console.log('\n2. MX Records for "mail.trackifyapp.co.in":');
    const mailMx = await dnsPromises.resolveMx('mail.trackifyapp.co.in');
    console.log(mailMx);
  } catch (e) {
    console.log('   Error resolving MX for mail.trackifyapp.co.in:', e.message);
  }

  try {
    console.log('\n3. TXT Records for "trackifyapp.co.in":');
    const rootTxt = await dnsPromises.resolveTxt('trackifyapp.co.in');
    console.log(rootTxt);
  } catch (e) {
    console.log('   Error resolving TXT for trackifyapp.co.in:', e.message);
  }

  try {
    console.log('\n4. TXT Records for "mail.trackifyapp.co.in":');
    const mailTxt = await dnsPromises.resolveTxt('mail.trackifyapp.co.in');
    console.log(mailTxt);
  } catch (e) {
    console.log('   Error resolving TXT for mail.trackifyapp.co.in:', e.message);
  }

  try {
    console.log('\n5. DMARC Records for "_dmarc.trackifyapp.co.in":');
    const dmarcTxt = await dnsPromises.resolveTxt('_dmarc.trackifyapp.co.in');
    console.log(dmarcTxt);
  } catch (e) {
    console.log('   Error resolving DMARC:', e.message);
  }
}

checkDNS();
