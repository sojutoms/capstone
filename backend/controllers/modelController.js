// controllers/modelController.js
const Product = require("../models/Product");
const { createMultiviewTask, pollTaskUntilDone } = require("../utils/tripo3d");
const { renderAndUploadTurntable } = require("../utils/turntableRenderer");

// ─── Background pipeline: Tripo3D generation → render turntable frames ────────
// Note: we deliberately don't re-host the GLB permanently — Cloudinary's plan
// on this account caps raw files at 10MB and shoe GLBs regularly run 20-40MB+.
// Nothing downstream (the 360 viewer, the AR overlay) actually consumes the
// raw GLB — only the rendered frame images, which are small and permanent on
// Cloudinary. We render straight from Tripo3D's own model URL and store that
// URL as a best-effort reference (it will eventually expire).
const runGenerationPipeline = async (productId, imageSelection) => {
  try {
    const product = await Product.findOne({ id: productId });
    if (!product) return;

    const { front, left, back, right } = imageSelection;

    const taskId = await createMultiviewTask({ front, left, back, right });
    product.model3d.taskId = taskId;
    await product.save();

    const tripoModelUrl = await pollTaskUntilDone(taskId);

    product.model3d.glbUrl = tripoModelUrl;
    product.model3d.status = "rendering";
    await product.save();

    const turntableFrames = await renderAndUploadTurntable(productId, tripoModelUrl);

    product.model3d.turntableFrames = turntableFrames;
    product.model3d.status = "ready";
    product.model3d.generatedAt = new Date();
    product.model3d.error = "";
    await product.save();
  } catch (err) {
    console.error(`3D generation failed for product ${productId}:`, err.message);
    await Product.updateOne(
      { id: productId },
      { $set: { "model3d.status": "failed", "model3d.error": err.message } }
    );
  }
};

// ─── POST /generate-3d-model ────────────────────────────────────────────────
const generateModel = async (req, res) => {
  try {
    const { productId, images } = req.body;
    const product = await Product.findOne({ id: productId });
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    if (!product.image) {
      return res.status(400).json({ success: false, error: "Product needs a main image before generating a 3D model" });
    }
    if (product.model3d?.status === "processing" || product.model3d?.status === "rendering") {
      return res.status(409).json({ success: false, error: "A 3D model is already generating for this product" });
    }

    // The admin can hand-pick which 4 photos represent front/left/back/right
    // of the SAME physical shoe — important because a catalog's image +
    // subImages often mix single-shoe and paired-shoe shots, which produces
    // warped geometry if fed to multiview reconstruction as-is. Falls back to
    // the old positional heuristic when no explicit selection is sent.
    const imageSelection = images?.front
      ? { front: images.front, left: images.left || "", back: images.back || "", right: images.right || "" }
      : {
          front: product.image,
          left: product.subImages?.[0] || "",
          back: product.subImages?.[1] || "",
          right: product.subImages?.[2] || "",
        };

    product.model3d = { status: "processing", taskId: null, glbUrl: "", turntableFrames: [], error: "", generatedAt: null };
    await product.save();

    // Fire-and-forget — the admin polls /model-status/:productId for progress.
    runGenerationPipeline(productId, imageSelection);

    res.json({ success: true, status: "processing" });
  } catch (err) {
    console.error("generateModel error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

// ─── GET /model-status/:productId ───────────────────────────────────────────
const getModelStatus = async (req, res) => {
  try {
    const product = await Product.findOne({ id: Number(req.params.productId) }, "model3d");
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    res.json({ success: true, model3d: product.model3d });
  } catch (err) {
    console.error("getModelStatus error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

module.exports = { generateModel, getModelStatus };
