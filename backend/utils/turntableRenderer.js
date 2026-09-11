// utils/turntableRenderer.js
// Renders a StockX-style turntable frame sequence from a GLB, headlessly, via
// Puppeteer + Google's <model-viewer> web component. Frames are uploaded to
// Cloudinary and their URLs returned in angle order.
const puppeteer = require("puppeteer");
const axios = require("axios");
const { cloudinary } = require("../config/multer");

const FRAME_COUNT = 24; // 15° steps
const VIEWPORT = 800;
// Placeholder same-origin-looking URL — never actually hits the network.
// Puppeteer's request interception fulfills it locally with the GLB bytes we
// already downloaded server-side, sidestepping Tripo3D's CDN not sending
// Access-Control-Allow-Origin (which blocks a direct in-page fetch of it).
const LOCAL_MODEL_URL = "https://local.internal/model.glb";

let browserPromise = null;
const getBrowser = () => {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: "new",
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        // Chrome disables software-rendered WebGL by default for security;
        // this is required for <model-viewer> to get a GL context headlessly.
        "--enable-unsafe-swiftshader",
        "--no-sandbox",
      ],
    });
  }
  return browserPromise;
};

const buildHtml = () => `<!doctype html>
<html><head><meta charset="utf-8" />
<script type="module" src="https://unpkg.com/@google/model-viewer@^3/dist/model-viewer.min.js"></script>
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  model-viewer { width: ${VIEWPORT}px; height: ${VIEWPORT}px; }
</style>
</head><body>
<model-viewer id="mv" src="${LOCAL_MODEL_URL}" camera-controls="false" disable-zoom
  shadow-intensity="1" exposure="1" environment-image="neutral" interpolation-decay="0"
  style="background-color: transparent"></model-viewer>
</body></html>`;

/** Renders `frameCount` PNG buffers, evenly spaced around a full turntable rotation. */
const renderTurntableFrames = async (glbUrl, { frameCount = FRAME_COUNT } = {}) => {
  const { data: glbBytes } = await axios.get(glbUrl, { responseType: "arraybuffer" });

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (req.url() === LOCAL_MODEL_URL) {
        req.respond({
          status: 200,
          contentType: "model/gltf-binary",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: Buffer.from(glbBytes),
        });
      } else {
        req.continue();
      }
    });

    await page.setViewport({ width: VIEWPORT, height: VIEWPORT, deviceScaleFactor: 1 });
    await page.setContent(buildHtml(), { waitUntil: "networkidle0" });
    await page.waitForFunction(
      () => document.getElementById("mv")?.loaded === true,
      { timeout: 60000 }
    );

    const el = await page.$("#mv");
    const frames = [];
    for (let i = 0; i < frameCount; i++) {
      const deg = i * (360 / frameCount);
      await page.evaluate((d) => {
        const mv = document.getElementById("mv");
        mv.cameraOrbit = `${d}deg 78deg 105%`;
        mv.jumpCameraToGoal();
      }, deg);
      await new Promise((resolve) => setTimeout(resolve, 180)); // let the frame settle
      frames.push(await el.screenshot({ type: "png", omitBackground: true }));
    }
    return frames;
  } finally {
    await page.close();
  }
};

const uploadFrame = (buffer, productId, index) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `sneakyconcepts/turntables/${productId}`,
        public_id: `frame_${String(index).padStart(2, "0")}`,
        overwrite: true,
        format: "png",
      },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(buffer);
  });

/** Full pipeline: render frames from the GLB and upload them, in order. */
const renderAndUploadTurntable = async (productId, glbUrl, opts) => {
  const frameBuffers = await renderTurntableFrames(glbUrl, opts);
  const urls = [];
  for (let i = 0; i < frameBuffers.length; i++) {
    urls.push(await uploadFrame(frameBuffers[i], productId, i));
  }
  return urls;
};

module.exports = { renderAndUploadTurntable, FRAME_COUNT };
