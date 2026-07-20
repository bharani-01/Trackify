const sharp = require('sharp');
const path = require('path');

const inputPath = path.join(__dirname, '../assets/images/favicon.png');
const outputDir = path.join(__dirname, '../assets/images');

const sizes = [192, 512];

async function generate() {
  for (const size of sizes) {
    // Generate PNG
    const pngPath = path.join(outputDir, `favicon-${size}.png`);
    await sharp(inputPath)
      .resize(size, size)
      .toFile(pngPath);
    console.log(`Generated: ${pngPath}`);

    // Generate WebP
    const webpPath = path.join(outputDir, `favicon-${size}.webp`);
    await sharp(inputPath)
      .resize(size, size)
      .toFormat('webp')
      .toFile(webpPath);
    console.log(`Generated: ${webpPath}`);
  }
}

generate().catch(err => {
  console.error('Error generating icons:', err);
});
