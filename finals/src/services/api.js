const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:4000";

export default API_BASE_URL;

const authHeaders = (token) => ({
  "Content-Type": "application/json",
  "auth-token": token,
});

const jsonHeaders = { "Content-Type": "application/json" };

export const getOrderByNumber = (token, orderNumber) =>
  fetch(`${API_BASE_URL}/order/${orderNumber}`, {
    headers: authHeaders(token),
  }).then((r) => r.json());

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

export const subscribeNewsletter = (email) =>
  fetch(`${API_BASE_URL}/newsletter/subscribe`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email }),
  }).then((r) => r.json());
