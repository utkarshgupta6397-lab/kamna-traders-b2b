const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../public/logo.svg');
const outDir = path.join(__dirname, '../public/icons');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function generate() {
  const svgBuffer = fs.readFileSync(svgPath);
  
  const sizes = [
    { name: 'icon-192.png', size: 192, padding: 30 },
    { name: 'icon-512.png', size: 512, padding: 80 },
    { name: 'apple-touch-icon.png', size: 180, padding: 25 }
  ];

  for (const {name, size, padding} of sizes) {
    const innerSize = size - (padding * 2);
    
    // First resize the SVG to fit inside the padding
    const resizedSvg = await sharp(svgBuffer)
      .resize({ width: innerSize, height: innerSize, fit: 'contain', background: { r: 26, g: 39, b: 102, alpha: 0 } })
      .toBuffer();

    // Now composite it onto a solid background of the full size
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 26, g: 39, b: 102, alpha: 1 } // #1A2766
      }
    })
    .composite([{ input: resizedSvg }])
    .png()
    .toFile(path.join(outDir, name));
    
    console.log(`Generated ${name}`);
  }
}

generate().catch(console.error);
