const express = require("express");
const router = express.Router();
const { validateProduct, validate } = require("../middleware/validator");
const { requireRole, fetchUser } = require("../middleware/auth");
const {
  getAllProducts,
  addProduct,
  editProduct,
  removeProduct,
  restoreProduct,
  toggleNew,
  bulkUpdateNew,
  getFeatured,
  getNewCollections,
  fixSizes,
  fixAllSizes,
  migrateSizesWithPrices,
  addReview,
  getReviews,
  getMyReviews,
  addColorway,
  getAllReviews,
  deleteReview,
} = require("../controllers/productController");

const adminAuth = requireRole("admin", "owner");

router.get("/allproducts", getAllProducts);
router.post("/addproduct", adminAuth, validate(["name", "category"]), validateProduct, addProduct);
router.post("/addcolorway", adminAuth, validate(["parentId", "name"]), addColorway);
router.post("/editproduct", adminAuth, validate(["id"]), validateProduct, editProduct);
router.post("/removeproduct", adminAuth, removeProduct);
router.post("/restoreproduct", adminAuth, restoreProduct);
router.post("/togglenew", adminAuth, toggleNew);
router.post("/bulk-update-new", adminAuth, bulkUpdateNew);
router.get("/featured", getFeatured);
router.get("/newcollections", getNewCollections);
router.get("/fix-sizes", adminAuth, fixSizes);
router.get("/fix-all-sizes", adminAuth, fixAllSizes);
router.post("/migrate-sizes-with-prices", adminAuth, migrateSizesWithPrices);
router.post("/addreview", addReview);
router.get("/getreviews/:productId", getReviews);
router.get("/myreviews", fetchUser, getMyReviews);

module.exports = router;