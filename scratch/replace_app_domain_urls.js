const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'backend/src/services/reminderScheduler.js',
  'backend/src/utils/emailHelper.js',
  'backend/src/controllers/inboundEmailController.js',
  'frontend/index.html',
  'frontend/login.html',
  'frontend/register.html',
  'frontend/privacy-policy.html',
  'frontend/terms.html',
  'frontend/cookie-policy.html',
  'frontend/products/trackify.html',
  'frontend/products/inks.html',
  'frontend/robots.txt',
  'frontend/sitemap.xml'
];

async function replaceUrls() {
  console.log('=== REPLACING https://trackifyapp.co.in WITH https://app.trackifyapp.co.in ===\n');

  let totalReplacements = 0;

  for (const relPath of filesToUpdate) {
    const fullPath = path.join(__dirname, '..', relPath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`File not found: ${relPath}`);
      continue;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Replace all occurrences of https://trackifyapp.co.in (handling optional trailing slash carefully if needed)
    // Note: avoid double 'app.app' if already app.trackifyapp.co.in
    const matches = (content.match(/https:\/\/trackifyapp\.co\.in/g) || []).length;
    
    if (matches > 0) {
      content = content.replace(/https:\/\/trackifyapp\.co\.in/g, 'https://app.trackifyapp.co.in');
      fs.writeFileSync(fullPath, content, 'utf8');
      totalReplacements += matches;
      console.log(`✓ Updated ${matches} occurrences in: ${relPath}`);
    } else {
      console.log(`- 0 occurrences found in: ${relPath}`);
    }
  }

  console.log(`\n====================================================`);
  console.log(`COMPLETED: Replaced ${totalReplacements} domain references across ${filesToUpdate.length} files.`);
  console.log(`====================================================`);
}

replaceUrls();
