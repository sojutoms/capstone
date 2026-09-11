const express = require("express");
const router = express.Router();
const { requireRole } = require("../middleware/auth");
const { generateModel, getModelStatus } = require("../controllers/modelController");

const adminAuth = requireRole("admin", "owner");

router.post("/generate-3d-model", adminAuth, generateModel);
router.get("/model-status/:productId", adminAuth, getModelStatus);

module.exports = router;
