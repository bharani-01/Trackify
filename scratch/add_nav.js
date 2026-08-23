const fs = require('fs');
const path = require('path');

const targetDirs = ['frontend/admin', 'frontend/student'];

targetDirs.forEach(dir => {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
  files.forEach(f => {
    const fullPath = path.join(dir, f);
    let content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes('app-nav.js')) {
      if (content.includes('</body>')) {
        content = content.replace('</body>', '  <script src="/assets/js/app-nav.js"></script>\n</body>');
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('✓ Added app-nav.js to:', fullPath);
      } else {
        console.warn('Could not find </body> in:', fullPath);
      }
    } else {
      console.log('Already has app-nav.js:', fullPath);
    }
  });
});
