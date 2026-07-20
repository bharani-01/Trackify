const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const imagesDir = path.join(__dirname, '../assets/images');

fs.readdirSync(imagesDir).forEach(async (file) => {
  if (file.endsWith('.png') || file.endsWith('.webp')) {
    const filePath = path.join(imagesDir, file);
    try {
      const metadata = await sharp(filePath).metadata();
      console.log(`${file}: ${metadata.width}x${metadata.height} (${metadata.format})`);
    } catch (err) {
      console.error(`Error reading ${file}:`, err.message);
    }
  }
});
