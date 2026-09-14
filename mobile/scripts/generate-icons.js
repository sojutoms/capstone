// Regenerate iOS icon, Android adaptive icon, splash screen icon, and web
// favicon from one master logo. Overwrites the files app.json already points
// at, so no config changes are needed.
//
//     node scripts/generate-icons.js
//
// Requires the `sharp` package (already installed in ../backend).

const path  = require("path");
const sharp = require(path.join(__dirname, "..", "..", "backend", "node_modules", "sharp"));

const ASSETS = path.join(__dirname, "..", "assets");
const SOURCE = path.join(ASSETS, "goodsoleslogo.jpg");

async function main() {
  const meta = await sharp(SOURCE).metadata();
  console.log(`Source: ${SOURCE}  (${meta.width}x${meta.height} ${meta.format})`);

  await sharp(SOURCE)
    .resize(1024, 1024, { fit: "cover" })
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .png()
    .toFile(path.join(ASSETS, "icon.png"));
  console.log("✔  icon.png            1024x1024  (iOS app icon, opaque)");

  const foregroundSize = Math.round(1024 * 0.66);
  const foregroundBuffer = await sharp(SOURCE)
    .resize(foregroundSize, foregroundSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: foregroundBuffer, gravity: "center" }])
    .png()
    .toFile(path.join(ASSETS, "adaptive-icon.png"));
  console.log("✔  adaptive-icon.png   1024x1024  (Android foreground, transparent, safe-zone padded)");

  const splashLogoSize = 512;
  const splashLogoBuffer = await sharp(SOURCE)
    .resize(splashLogoSize, splashLogoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 1242,
      height: 2436,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: splashLogoBuffer, gravity: "center" }])
    .png()
    .toFile(path.join(ASSETS, "splash-icon.png"));
  console.log("✔  splash-icon.png     1242x2436  (splash, transparent, logo centered)");

  await sharp(SOURCE)
    .resize(48, 48, { fit: "cover" })
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .png()
    .toFile(path.join(ASSETS, "favicon.png"));
  console.log("✔  favicon.png         48x48      (web favicon)");
}

main().catch((err) => { console.error(err); process.exit(1); });
