// src/services/api.js
// ─────────────────────────────────────────────────────────────
// Single file for all API calls.
// In development  → http://localhost:4000  (npm start)
// In production   → your Render URL       (npm run build)
// ─────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:4000";

export default API_BASE_URL;

// ─── Helpers ──────────────────────────────────────────────────
const authHeaders = (token) => ({
  "Content-Type": "application/json",
  "auth-token": token,
});

const jsonHeaders = { "Content-Type": "application/json" };

// ═════════════════════════════════════════════════════════════
// PRODUCTS
// ═════════════════════════════════════════════════════════════

export const getAllProducts = (showDeleted = false) =>
  fetch(`${API_BASE_URL}/allproducts?showDeleted=${showDeleted}`).then((r) =>
    r.json()
  );

export const getFeaturedProducts = () =>
  fetch(`${API_BASE_URL}/featured`).then((r) => r.json());

export const getNewCollections = () =>
  fetch(`${API_BASE_URL}/newcollections`).then((r) => r.json());

export const addProduct = (data) =>
  fetch(`${API_BASE_URL}/addproduct`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(data),
  }).then((r) => r.json());

export const editProduct = (data) =>
  fetch(`${API_BASE_URL}/editproduct`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(data),
  }).then((r) => r.json());

export const removeProduct = (id) =>
  fetch(`${API_BASE_URL}/removeproduct`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ id }),
  }).then((r) => r.json());

export const restoreProduct = (id) =>
  fetch(`${API_BASE_URL}/restoreproduct`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ id }),
  }).then((r) => r.json());

export const toggleNew = (id, isNew) =>
  fetch(`${API_BASE_URL}/togglenew`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ id, isNew }),
  }).then((r) => r.json());

export const bulkUpdateNew = () =>
  fetch(`${API_BASE_URL}/bulk-update-new`, { method: "POST" }).then((r) =>
    r.json()
  );

// ═════════════════════════════════════════════════════════════
// IMAGE UPLOAD
// ═════════════════════════════════════════════════════════════

export const uploadImage = (file) => {
  const formData = new FormData();
  formData.append("product", file);
  return fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  }).then((r) => r.json());
};

export const uploadMultipleImages = (files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("product", file));
  return fetch(`${API_BASE_URL}/upload-multiple`, {
    method: "POST",
    body: formData,
  }).then((r) => r.json());
};

// ═════════════════════════════════════════════════════════════
// AUTH — USER
// ═════════════════════════════════════════════════════════════

export const login = (email, password) =>
  fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());

export const signup = ({ firstName, lastName, email, password }) =>
  fetch(`${API_BASE_URL}/signup`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ firstName, lastName, email, password }),
  }).then((r) => r.json());

export const verifyOtp = (email, otp) =>
  fetch(`${API_BASE_URL}/verify-otp`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email, otp }),
  }).then((r) => r.json());

export const forgotPassword = (email) =>
  fetch(`${API_BASE_URL}/forgot-password`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email }),
  }).then((r) => r.json());

export const resetPassword = (email, otp, newPassword) =>
  fetch(`${API_BASE_URL}/reset-password`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email, otp, newPassword }),
  }).then((r) => r.json());

export const getUserProfile = (token) =>
  fetch(`${API_BASE_URL}/user/profile`, {
    headers: authHeaders(token),
  }).then((r) => r.json());

export const updateUserProfile = (token, data) =>
  fetch(`${API_BASE_URL}/user/profile`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  }).then((r) => r.json());

export const deleteUser = (token) =>
  fetch(`${API_BASE_URL}/user`, {
    method: "DELETE",
    headers: authHeaders(token),
  }).then((r) => r.json());

// ═════════════════════════════════════════════════════════════
// AUTH — ADMIN
// ═════════════════════════════════════════════════════════════

export const adminLogin = (email, password) =>
  fetch(`${API_BASE_URL}/admin/login`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email, password }),
  }).then((r) => r.json());

export const getAllUsers = () =>
  fetch(`${API_BASE_URL}/allusers`).then((r) => r.json());

export const removeUser = (id) =>
  fetch(`${API_BASE_URL}/removeuser`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ id }),
  }).then((r) => r.json());

export const blockUser = (id, block) =>
  fetch(`${API_BASE_URL}/blockuser`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ id, block }),
  }).then((r) => r.json());

export const assignRole = (token, userId, roles) =>
  fetch(`${API_BASE_URL}/admin/assign-role`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ userId, roles }),
  }).then((r) => r.json());

export const createStaff = (token, staffData) =>
  fetch(`${API_BASE_URL}/admin/create-staff`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(staffData),
  }).then((r) => r.json());

// ═════════════════════════════════════════════════════════════
// CART
// ═════════════════════════════════════════════════════════════

export const getCart = (token) =>
  fetch(`${API_BASE_URL}/getcart`, {
    method: "POST",
    headers: authHeaders(token),
  }).then((r) => r.json());

export const addToCart = (token, itemId, size) =>
  fetch(`${API_BASE_URL}/addtocart`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ itemId, size }),
  }).then((r) => r.json());

export const removeFromCart = (token, itemId, size) =>
  fetch(`${API_BASE_URL}/removefromcart`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ itemId, size }),
  }).then((r) => r.json());

export const clearCart = (token) =>
  fetch(`${API_BASE_URL}/clearcart`, {
    method: "POST",
    headers: authHeaders(token),
  }).then((r) => r.json());

export const validateCart = (token, items) =>
  fetch(`${API_BASE_URL}/validate-cart`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ items }),
  }).then((r) => r.json());

// ═════════════════════════════════════════════════════════════
// ORDERS — CUSTOMER
// ═════════════════════════════════════════════════════════════

export const placeOrder = (token, orderData) =>
  fetch(`${API_BASE_URL}/placeorder`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(orderData),
  }).then((r) => r.json());

export const getOrderHistory = (token, page = 1, limit = 5, status = "all") =>
  fetch(`${API_BASE_URL}/orderhistory?page=${page}&limit=${limit}&status=${status}`, {
    headers: authHeaders(token),
  }).then((r) => r.json());

export const cancelOrder = (token, orderNumber) =>
  fetch(`${API_BASE_URL}/order/${orderNumber}/cancel`, {
    method: "POST",
    headers: authHeaders(token),
  }).then((r) => r.json());

export const requestRefund = (token, orderNumber, reason) =>
  fetch(`${API_BASE_URL}/order/${orderNumber}/refund`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ reason }),
  }).then((r) => r.json());

export const getOrderByNumber = (token, orderNumber) =>
  fetch(`${API_BASE_URL}/order/${orderNumber}`, {
    headers: authHeaders(token),
  }).then((r) => r.json());

// ═════════════════════════════════════════════════════════════
// PAYMENTS — PAYMONGO
// ═════════════════════════════════════════════════════════════

export const createCheckoutSession = (token, orderNumber) =>
  fetch(`${API_BASE_URL}/create-checkout-session`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ orderNumber }),
  }).then((r) => r.json());

export const verifyPaymentStatus = (token, orderNumber) =>
  fetch(`${API_BASE_URL}/payment/verify/${orderNumber}`, {
    headers: authHeaders(token),
  }).then((r) => r.json());

export const requestReturn = (token, orderNumber, formData) =>
  // formData is a FormData object (contains reason, notes, optional image)
  fetch(`${API_BASE_URL}/order/${orderNumber}/return`, {
    method: "POST",
    headers: { "auth-token": token }, // no Content-Type — browser sets multipart boundary
    body: formData,
  }).then((r) => r.json());

// ═════════════════════════════════════════════════════════════
// ORDERS — ADMIN
// ═════════════════════════════════════════════════════════════

export const getAdminOrders = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetch(`${API_BASE_URL}/admin/orders?${query}`).then((r) => r.json());
};

export const getAdminOrder = (orderNumber) =>
  fetch(`${API_BASE_URL}/admin/order/${orderNumber}`).then((r) => r.json());

export const updateOrderStatus = (orderNumber, status) =>
  fetch(`${API_BASE_URL}/admin/order/${orderNumber}/status`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ status }),
  }).then((r) => r.json());

export const getSalesData = (year, month) => {
  const params = new URLSearchParams({ year });
  if (month) params.append("month", month);
  return fetch(`${API_BASE_URL}/salesdata?${params}`).then((r) => r.json());
};

// ═════════════════════════════════════════════════════════════
// FAVORITES
// ═════════════════════════════════════════════════════════════

export const getUserFavorites = (token) =>
  fetch(`${API_BASE_URL}/userfavorites`, {
    headers: authHeaders(token),
  }).then((r) => r.json());

export const addFavorite = (token, productId) =>
  fetch(`${API_BASE_URL}/addfavorite`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ productId: String(productId) }),
  }).then((r) => r.json());

export const removeFavorite = (token, productId) =>
  fetch(`${API_BASE_URL}/removefavorite`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ productId: String(productId) }),
  }).then((r) => r.json());

export const clearAllFavorites = (token) =>
  fetch(`${API_BASE_URL}/clearfavorites`, {
    method: "POST",
    headers: authHeaders(token),
  }).then((r) => r.json());

// ═════════════════════════════════════════════════════════════
// ADDRESSES
// ═════════════════════════════════════════════════════════════

export const getSavedAddresses = (token) =>
  fetch(`${API_BASE_URL}/getsavedaddresses`, {
    headers: authHeaders(token),
  }).then((r) => r.json());

export const saveAddress = (token, address) =>
  fetch(`${API_BASE_URL}/saveaddress`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ address }),
  }).then((r) => r.json());

export const deleteAddress = (token, index) =>
  fetch(`${API_BASE_URL}/deleteaddress/${index}`, {
    method: "DELETE",
    headers: authHeaders(token),
  }).then((r) => r.json());

export const manageSavedAddress = (token, action, payload = {}) =>
  fetch(`${API_BASE_URL}/savedaddresses`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ action, ...payload }),
  }).then((r) => r.json());

export const updateAddress = (token, index, address) =>
  fetch(`${API_BASE_URL}/updateaddress/${index}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(address),
  }).then((r) => r.json());

// ═════════════════════════════════════════════════════════════
// VOUCHERS / POINTS
// ═════════════════════════════════════════════════════════════

export const getUserVouchers = (token) =>
  fetch(`${API_BASE_URL}/my-vouchers`, {
    headers: { "auth-token": token },
  }).then((r) => r.json());

export const applyVoucher = (token, code, subtotal) =>
  fetch(`${API_BASE_URL}/apply-voucher`, {
    method: "POST",
    headers: { ...jsonHeaders, "auth-token": token },
    body: JSON.stringify({ code, subtotal }),
  }).then((r) => r.json());



// ═════════════════════════════════════════════════════════════
// REVIEWS
// ═════════════════════════════════════════════════════════════

export const getReviews = (productId) =>
  fetch(`${API_BASE_URL}/getreviews/${productId}`).then((r) => r.json());

// ── Full review submission with auth token and all fields ──
export const addReview = ({ productId, rating, review, title, fit, comfort, recommend }) => {
  const token = localStorage.getItem("auth-token");
  return fetch(`${API_BASE_URL}/addreview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "auth-token": token } : {}),
    },
    body: JSON.stringify({ productId, rating, review, title, fit, comfort, recommend }),
  }).then((r) => r.json());
};

// ═════════════════════════════════════════════════════════════
// SKU / STOCK
// ═════════════════════════════════════════════════════════════

export const addStock = ({ productId, size, quantity, price }) =>
  fetch(`${API_BASE_URL}/addstock`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ productId, size, quantity, price }),
  }).then((r) => r.json());

export const getAllSequences = () =>
  fetch(`${API_BASE_URL}/allsequences`).then((r) => r.json());

export const getSequencesByProduct = (productId) =>
  fetch(`${API_BASE_URL}/sequences/${productId}`).then((r) => r.json());

export const markSequenceSold = (sequenceId) =>
  fetch(`${API_BASE_URL}/marksequencesold`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ sequenceId }),
  }).then((r) => r.json());

export const deleteSequence = (sequenceId) =>
  fetch(`${API_BASE_URL}/deletesequence`, {
    method: "DELETE",
    headers: jsonHeaders,
    body: JSON.stringify({ sequenceId }),
  }).then((r) => r.json());

export const restoreSequence = (sequenceId) =>
  fetch(`${API_BASE_URL}/restoresequence`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ sequenceId }),
  }).then((r) => r.json());

export const getSkuStats = () =>
  fetch(`${API_BASE_URL}/skustats`).then((r) => r.json());

export const assignSequence = ({ productId, size, userId }) =>
  fetch(`${API_BASE_URL}/assignsequence`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ productId, size, userId }),
  }).then((r) => r.json());

export const syncProductSkus = (productId) =>
  fetch(`${API_BASE_URL}/sync_product_skus`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ productId }),
  }).then((r) => r.json());

export const createSkusForProduct = (productId, sizes, options = {}) =>
  fetch(`${API_BASE_URL}/create_skus_for_product`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ productId, sizes, ...options }),
  }).then((r) => r.json());

export const getUserPurchases = (userId) =>
  fetch(`${API_BASE_URL}/userpurchases/${userId}`).then((r) => r.json());

export const releaseExpiredReservations = () =>
  fetch(`${API_BASE_URL}/releaseexpiredreservations`, {
    method: "POST",
  }).then((r) => r.json());

// ═════════════════════════════════════════════════════════════
// ADMIN STATS
// ═════════════════════════════════════════════════════════════

export const getStatsOverview = () =>
  fetch(`${API_BASE_URL}/admin/stats/overview`).then((r) => r.json());

export const getMonthlySales = () =>
  fetch(`${API_BASE_URL}/admin/stats/monthly-sales`).then((r) => r.json());

export const getCategorySales = () =>
  fetch(`${API_BASE_URL}/admin/stats/category-sales`).then((r) => r.json());

export const getLowStock = () =>
  fetch(`${API_BASE_URL}/admin/stats/low-stock`).then((r) => r.json());