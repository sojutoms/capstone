import { Platform } from "react-native";

// ─── CONFIG ────────────────────────────────────────────────────────────────────
// On web (Expo web), use localhost directly — no ngrok header needed.
// On native (iOS/Android), use your ngrok URL.
const IS_WEB = Platform.OS === "web";

const BASE_URL = IS_WEB
  ? "http://localhost:4000"
  : "https://unlaboured-charise-unmachined.ngrok-free.dev";

// NOTE: The "ngrok-skip-browser-warning" header causes CORS preflight to fail
// when running on web (localhost:8081) because the backend doesn't whitelist it.
// We only send it on native where it's actually needed.
const getHeaders = () => ({
  "Content-Type": "application/json",
  ...(IS_WEB ? {} : { "ngrok-skip-browser-warning": "true" }),
});

// ─── Helper ────────────────────────────────────────────────────────────────────
async function post(path, body) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.log("❌ NETWORK ERROR:", err);
    return { ok: false, status: 0, data: { message: "Network error. Check your server or connection." } };
  }
}

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
export async function loginUser(email, password) {
  console.log("🔐 LOGIN REQUEST:", { email, password });
  console.log("🌐 URL:", `${BASE_URL}/login`);

  const { ok, data } = await post("/login", { email, password });

  if (!ok) {
    return { success: false, errors: data.message || data.errors || "Login failed" };
  }
  return { success: true, token: data.token, user: data.user };
}

// ─── SIGNUP (sends OTP) ────────────────────────────────────────────────────────
export async function signupUser({ firstName, lastName, email, phone, password }) {
  console.log("📝 SIGNUP REQUEST:", { firstName, lastName, email, phone });

  const { ok, data } = await post("/signup", { firstName, lastName, email, phone, password });

  if (!ok) {
    return {
      success: false,
      errors: data.message || data.errors || "Signup failed",
      field: data.field || null,
    };
  }
  return { success: true, data };
}

// ─── VERIFY OTP ────────────────────────────────────────────────────────────────
export async function verifyOtp(email, otp) {
  console.log("🔢 VERIFY OTP:", { email, otp });

  const { ok, data } = await post("/verify-otp", { email, otp });

  if (!ok) {
    return { success: false, errors: data.message || data.errors || "OTP verification failed" };
  }
  return { success: true, token: data.token };
}

// ─── FORGOT PASSWORD ───────────────────────────────────────────────────────────
export async function forgotPassword(email) {
  console.log("📧 FORGOT PASSWORD:", { email });

  const { ok, data } = await post("/forgot-password", { email });

  if (!ok) {
    return { success: false, errors: data.message || data.errors || "Failed to send reset OTP" };
  }
  return { success: true };
}

// ─── RESET PASSWORD ────────────────────────────────────────────────────────────
export async function resetPassword(email, otp, newPassword) {
  console.log("🔄 RESET PASSWORD:", { email, otp });

  const { ok, data } = await post("/reset-password", { email, otp, newPassword });

  if (!ok) {
    return { success: false, errors: data.message || data.errors || "Password reset failed" };
  }
  return { success: true };
}