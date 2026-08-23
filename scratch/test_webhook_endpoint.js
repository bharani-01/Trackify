const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const dnsPromises = dns.promises;
const https = require('https');

async function testAppEndpoint() {
  console.log('=== TESTING app.trackifyapp.co.in ===\n');

  try {
    const aRecords = await dnsPromises.resolve4('app.trackifyapp.co.in');
    console.log('1. A records for app.trackifyapp.co.in:', aRecords);
  } catch (e) {
    console.log('1. DNS error for app.trackifyapp.co.in:', e.message);
  }

  try {
    const aRoot = await dnsPromises.resolve4('trackifyapp.co.in');
    console.log('2. A records for trackifyapp.co.in:', aRoot);
  } catch (e) {
    console.log('2. DNS error for trackifyapp.co.in:', e.message);
  }

  // Test HTTP connection to app.trackifyapp.co.in
  https.get('https://app.trackifyapp.co.in/api/webhooks/resend-inbound', (res) => {
    console.log('3. HTTPS response status from app.trackifyapp.co.in:', res.statusCode);
  }).on('error', (err) => {
    console.log('3. HTTPS connection error to app.trackifyapp.co.in:', err.message);
  });

  // Test HTTP connection to trackifyapp.co.in
  https.get('https://trackifyapp.co.in/api/webhooks/resend-inbound', (res) => {
    console.log('4. HTTPS response status from trackifyapp.co.in:', res.statusCode);
  }).on('error', (err) => {
    console.log('4. HTTPS connection error to trackifyapp.co.in:', err.message);
  });
}

testAppEndpoint();
