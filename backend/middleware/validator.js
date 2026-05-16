/**
 * Generic validation middleware.
 * Validates req.body against a required fields list.
 */
const validate = (requiredFields) => (req, res, next) => {
  const missing = requiredFields.filter((f) => !req.body[f]);
  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Missing required fields: ${missing.join(", ")}`,
    });
  }
  next();
};

/**
 * Specifically for product addition/editing to ensure data types are correct.
 */
const validateProduct = (req, res, next) => {
  const { name, category, price, stock } = req.body;
  
  if (name && typeof name !== "string") return res.status(400).json({ success: false, error: "Name must be a string" });
  if (price && isNaN(Number(price))) return res.status(400).json({ success: false, error: "Price must be a number" });
  
  next();
};

module.exports = { validate, validateProduct };
