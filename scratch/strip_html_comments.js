const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

function walkDir(dir) {
  let files = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files = files.concat(walkDir(fullPath));
    } else if (item.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripCommentsFromFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Strip all <!-- ... --> comments except <!DOCTYPE ...> or conditional IE comments if any
  const stripped = content.replace(/<!--(?!DOCTYPE)[\s\S]*?-->/g, '');
  fs.writeFileSync(filePath, stripped, 'utf8');
  console.log(`Cleaned HTML comments from: ${path.relative(FRONTEND_DIR, filePath)}`);
}

const htmlFiles = walkDir(FRONTEND_DIR);
console.log(`Found ${htmlFiles.length} HTML files. Cleaning comments...`);
htmlFiles.forEach(stripCommentsFromFile);
console.log('✅ ALL HTML COMMENTS STRIPPED CLEANLY!');
