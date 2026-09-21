const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const upload = require("../config/multer");
const { cloudinary } = upload;
const Product = require("../models/Product");
const { requireRole, fetchUser } = require("../middleware/auth");

// Catalog-image uploads (multi-file, duplicate-checking) are an admin/staff
// action, not a public one.
const uploadAuth = requireRole("owner", "admin", "staff", "inventory_staff");
// Single-file /upload is shared with customer profile-picture uploads
// (Settings.jsx), so it only needs "logged in", not an admin role.
const anyAuthUser = fetchUser;

const extractPublicId = (url) => {
  try {
    return url.split("/upload/")[1].replace(/^v\d+\//, "").replace(/\.[^.]+$/, "");
  } catch { return null; }
};

const getAllStoredUrls = async () => {
  const products = await Product.find({}, "image subImages colorways");
  const urls = [];
  for (const p of products) {
    if (p.image) urls.push(p.image);
    (p.subImages ?? []).forEach((u) => urls.push(u));
    for (const cw of p.colorways ?? []) {
      if (cw.image) urls.push(cw.image);
      (cw.subImages ?? []).forEach((u) => urls.push(u));
    }
  }
  return urls;
};

router.post("/upload", anyAuthUser, (req, res) => {
  upload.single("product")(req, res, (err) => {
    if (err) {
      console.error(">>> Multer/Cloudinary error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file received" });
    }
    res.json({ success: true, image_url: req.file.path });
  });
});

router.post("/upload-multiple", uploadAuth, (req, res) => {
  upload.array("product", 5)(req, res, (err) => {
    if (err) {
      console.error("Upload-multiple error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: "No files received" });
    }
    res.json({ success: true, image_urls: req.files.map((f) => f.path) });
  });
});

router.post("/check-duplicate-image", uploadAuth, (req, res) => {
  upload.single("product")(req, res, async (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: "No file received" });

    const uploadedUrl = req.file.path;
    const uploadedId  = extractPublicId(uploadedUrl);

    try {
      const existingUrls = await getAllStoredUrls();
      const isDuplicate  = existingUrls.some((u) => extractPublicId(u) === uploadedId);

      if (isDuplicate) {
        await cloudinary.uploader.destroy(req.file.filename); // clean up orphan
        return res.json({ success: true, duplicate: true, image_url: null });
      }
      res.json({ success: true, duplicate: false, image_url: uploadedUrl });
    } catch (e) {
      res.json({ success: true, duplicate: false, image_url: uploadedUrl }); // fail open
    }
  });
});

// POST /check-duplicate-images-multiple  (up to 4 files)
router.post("/check-duplicate-images-multiple", uploadAuth, (req, res) => {
  upload.array("product", 4)(req, res, async (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!req.files?.length) return res.status(400).json({ success: false, error: "No files received" });

    try {
      const existingUrls = await getAllStoredUrls();
      for (const file of req.files) {
        const isDuplicate = existingUrls.some((u) => extractPublicId(u) === extractPublicId(file.path));
        if (isDuplicate) {
          // Clean up all just-uploaded files before rejecting
          await Promise.all(req.files.map((f) => cloudinary.uploader.destroy(f.filename)));
          return res.json({ success: true, duplicate: true, image_urls: [] });
        }
      }
      res.json({ success: true, duplicate: false, image_urls: req.files.map((f) => f.path) });
    } catch (e) {
      res.json({ success: true, duplicate: false, image_urls: req.files.map((f) => f.path) });
    }
  });
});

// ─── DeepAR .deepar effect upload (shoe products only) ────────────────────────
// Uploaded to Cloudinary as a `raw` resource, since Render's filesystem is
// ephemeral (every redeploy wipes local writes). Cloudinary hands back a
// permanent HTTPS URL that we store on the Product as `model3d.deeparEffect`;
// the mobile AR WebView loads it directly (see artryon/index.html and
// mobile/src/screens/ARTryOnScreen.jsx).
const uploadArEffect = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — largest existing effect is ~7MB
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".deepar")) {
      return cb(new Error("Only .deepar files are allowed"));
    }
    cb(null, true);
  },
});

const uploadDeeparBufferToCloudinary = (buffer, originalName) =>
  new Promise((resolve, reject) => {
    const safeBase = path
      .basename(originalName, ".deepar")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: "goodsoles/artryon",
        public_id: `${Date.now()}-${safeBase}.deepar`,
        use_filename: false,
        unique_filename: false,
        overwrite: false,
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

router.post("/admin/upload-ar-effect", uploadAuth, (req, res) => {
  uploadArEffect.single("arEffect")(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: "No file received" });
    try {
      const result = await uploadDeeparBufferToCloudinary(
        req.file.buffer,
        req.file.originalname
      );
      // Return `filename` (the full HTTPS URL) so existing admin code that
      // stashes the response's `filename` into product.deeparEffect keeps
      // working with no changes.
      res.json({ success: true, filename: result.secure_url });
    } catch (uploadErr) {
      console.error(">>> Cloudinary AR effect upload error:", uploadErr);
      res.status(500).json({ success: false, error: uploadErr.message || "Upload failed" });
    }
  });
});

module.exports = router;