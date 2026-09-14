import { Platform } from "react-native";

// ─── CONFIG ────────────────────────────────────────────────────────────────────
// On web (Expo web), use localhost directly — no ngrok header needed.
// On native (iOS/Android), use your ngrok URL.
const IS_WEB = Platform.OS === "web";

const BASE_URL = IS_WEB
  ? "http://localhost:4000"
  : "https://lifting-manpower-corral.ngrok-free.dev";

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

// The backend responds with HTTP 200 + { success: false, errors: "..." } on
// business failures (invalid OTP, bad login, etc.), so treat that as failure
// too — not only non-2xx HTTP.
const failed = (ok, data) => !ok || data?.success === false;

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
export async function loginUser(email, password) {
  console.log("🔐 LOGIN REQUEST:", { email, password });
  console.log("🌐 URL:", `${BASE_URL}/login`);

  const { ok, data } = await post("/login", { email, password });

  if (failed(ok, data)) {
    return { success: false, errors: data.message || data.errors || "Login failed" };
  }
  return { success: true, token: data.token, user: data.user };
}

// ─── SIGNUP (sends OTP) ────────────────────────────────────────────────────────
export async function signupUser({ firstName, lastName, email, phone, password }) {
  console.log("📝 SIGNUP REQUEST:", { firstName, lastName, email, phone });

  const { ok, data } = await post("/signup", { firstName, lastName, email, phone, password });

  if (failed(ok, data)) {
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

  if (failed(ok, data) || !data.token) {
    return { success: false, errors: data.message || data.errors || "Invalid OTP" };
  }
  return { success: true, token: data.token };
}

// ─── FORGOT PASSWORD ───────────────────────────────────────────────────────────
export async function forgotPassword(email) {
  console.log("📧 FORGOT PASSWORD:", { email });

  const { ok, data } = await post("/forgot-password", { email });

  if (failed(ok, data)) {
    return { success: false, errors: data.message || data.errors || "Failed to send reset OTP" };
  }
  return { success: true };
}

// ─── RESEND OTP ────────────────────────────────────────────────────────────────
export async function resendOtp(email, type) {
  console.log("🔁 RESEND OTP:", { email, type });

  const { ok, data } = await post("/resend-otp", { email, type });

  if (failed(ok, data)) {
    return {
      success: false,
      errors: data.message || data.errors || "Failed to resend code",
      remainingSeconds: data.remainingSeconds,
    };
  }
  return { success: true };
}

// ─── VERIFY RESET OTP (does not consume it) ────────────────────────────────────
export async function verifyResetOtp(email, otp) {
  console.log("🔢 VERIFY RESET OTP:", { email, otp });

  const { ok, data } = await post("/verify-reset-otp", { email, otp });

  if (failed(ok, data)) {
    return { success: false, errors: data.message || data.errors || "Invalid OTP" };
  }
  return { success: true };
}

// ─── RESET PASSWORD ────────────────────────────────────────────────────────────
export async function resetPassword(email, otp, newPassword) {
  console.log("🔄 RESET PASSWORD:", { email, otp });

  const { ok, data } = await post("/reset-password", { email, otp, newPassword });

  if (failed(ok, data)) {
    return { success: false, errors: data.message || data.errors || "Password reset failed" };
  }
  return { success: true };
}