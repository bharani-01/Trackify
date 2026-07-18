const sharp = require('sharp');
const path = require('path');

const imgDir = path.join(__dirname, '../assets/images');

async function convert() {
  try {
    await sharp(path.join(imgDir, 'logo_dark.png'))
      .webp({ quality: 85 })
      .toFile(path.join(imgDir, 'logo_dark.webp'));
    console.log('logo_dark.png converted to logo_dark.webp');

    await sharp(path.join(imgDir, 'logo_light.png'))
      .webp({ quality: 85 })
      .toFile(path.join(imgDir, 'logo_light.webp'));
    console.log('logo_light.png converted to logo_light.webp');

    await sharp(path.join(imgDir, 'favicon.png'))
      .webp({ quality: 85 })
      .toFile(path.join(imgDir, 'favicon.webp'));
    console.log('favicon.png converted to favicon.webp');
  } catch (err) {
    console.error('Conversion failed:', err);
  }
}

convert();
