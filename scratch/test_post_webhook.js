const https = require('https');

function sendPost(urlStr) {
  const url = new URL(urlStr);
  const data = JSON.stringify({ type: 'test.ping' });

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    },
    timeout: 8000
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log(`[${url.hostname}] POST ${url.pathname} -> Status: ${res.statusCode}, Body: ${body}`);
    });
  });

  req.on('error', (e) => {
    console.log(`[${url.hostname}] POST error:`, e.message);
  });

  req.on('timeout', () => {
    console.log(`[${url.hostname}] POST timed out`);
    req.destroy();
  });

  req.write(data);
  req.end();
}

console.log('Sending POST to app.trackifyapp.co.in and trackifyapp.co.in...');
sendPost('https://app.trackifyapp.co.in/api/webhooks/resend-inbound');
sendPost('https://trackifyapp.co.in/api/webhooks/resend-inbound');
sendPost('https://trackify-z5y3.onrender.com/api/webhooks/resend-inbound');
