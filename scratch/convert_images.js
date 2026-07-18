const sharp = require('sharp');
const path = require('path');

const imgDir = path.join(__dirname, '../assets/images');

async function convert() {
  try {
    await sharp(path.join(imgDir, 'Logo.png'))
      .webp({ quality: 85 })
      .toFile(path.join(imgDir, 'Logo.webp'));
    console.log('Logo.png converted to Logo.webp');

    await sharp(path.join(imgDir, 'favicon.jpeg'))
      .webp({ quality: 85 })
      .toFile(path.join(imgDir, 'favicon.webp'));
    console.log('favicon.jpeg converted to favicon.webp');
  } catch (err) {
    console.error('Conversion failed:', err);
  }
}

convert();
