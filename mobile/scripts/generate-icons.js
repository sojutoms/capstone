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

  // Splash logo for the expo-splash-screen plugin. The plugin composites this
  // over its own backgroundColor (black) and sizes it via `imageWidth`, so this
  // is just the mark on transparency — NOT a full-screen canvas like the old
  // splash-icon.png the removed legacy `splash` key used.
  //
  // The master logo is a white mark on a solid black square, so its luminance
  // IS the alpha mask. linear() crushes JPEG noise in the black areas to a
  // true 0 so no grey haze survives around the mark on the black splash.
  const srcMeta = await sharp(SOURCE).metadata();
  const splashAlpha = await sharp(SOURCE).greyscale().linear(1.4, -28).raw().toBuffer();
  const splashWhite = await sharp({
    create: { width: srcMeta.width, height: srcMeta.height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).raw().toBuffer();

  const splashMark = await sharp(splashWhite, { raw: { width: srcMeta.width, height: srcMeta.height, channels: 3 } })
    .joinChannel(splashAlpha, { raw: { width: srcMeta.width, height: srcMeta.height, channels: 1 } })
    .png()
    .toBuffer();

  const splashTrimmed = await sharp(splashMark).trim({ threshold: 1 }).toBuffer();
  const splashFitted = await sharp(splashTrimmed)
    .resize(Math.round(1024 * 0.78), Math.round(1024 * 0.78), { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: splashFitted, gravity: "center" }])
    .png()
    .toFile(path.join(ASSETS, "splash-logo.png"));
  console.log("✔  splash-logo.png     1024x1024  (splash mark, white on transparent)");

  await sharp(SOURCE)
    .resize(48, 48, { fit: "cover" })
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .png()
    .toFile(path.join(ASSETS, "favicon.png"));
  console.log("✔  favicon.png         48x48      (web favicon)");
}

main().catch((err) => { console.error(err); process.exit(1); });
