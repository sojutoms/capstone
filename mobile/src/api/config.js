import { Platform } from "react-native";
import Constants from "expo-constants";

const IS_WEB = Platform.OS === "web";

// ─── Production backend ──────────────────────────────────────────────────────
// Real deployed URL. Must be HTTPS with a valid public cert (Apple ATS + the
// AR WebView's getUserMedia both require it). Change this and the AR override
// below the day you point the mobile app at a different backend.
const PROD_URL = "https://api.goodsolesph.online";

// ─── Per-developer override ─────────────────────────────────────────────────
// Set EXPO_PUBLIC_API_URL in a local .env (see .env.example) to point Expo Go
// at your own backend. Leaving it empty makes the app fall through to the
// deployed backend, so a fresh clone runs against production data with zero
// configuration — good for UI-only work, bad for backend changes.
const ENV_OVERRIDE = process.env.EXPO_PUBLIC_API_URL || "";

// ─── Dev host auto-detection ────────────────────────────────────────────────
// Read the dev machine's LAN IP that Expo Go used to load the JS bundle.
// Works across SDK versions: expoConfig (SDK 49+), expoGoConfig (SDK 50+), manifest (legacy).
const getExpoDevHost = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    "";
  const host = hostUri.split(":")[0] || "";
  // Only accept a plain LAN IP or a *.local hostname.
  // Tunnel hosts (foo.tunnel.dev.exp.host) don't proxy port 4000, so skip them.
  const isLanIp = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/.test(host);
  const isLocalHostname = /\.local$/.test(host);
  return isLanIp || isLocalHostname ? host : null;
};

const devHost = getExpoDevHost();

const resolveBaseUrl = () => {
  // 1. Explicit per-developer override always wins.
  if (ENV_OVERRIDE) return ENV_OVERRIDE;
  if (IS_WEB) return "http://localhost:4000";
  // 2. Production build (release) → deployed backend.
  if (!__DEV__) return PROD_URL;
  // 3. Dev fallback → deployed backend. A collaborator running Expo Go
  //    without their own backend just hits production instantly. To run
  //    against a local backend, they set EXPO_PUBLIC_API_URL in .env.
  return PROD_URL;
};

export const BASE_URL = resolveBaseUrl();

// ─── AR-specific URL ─────────────────────────────────────────────────────────
// AR Try-On uses navigator.mediaDevices.getUserMedia inside a WebView, which
// iOS/WebKit only exposes on HTTPS or localhost. Plain-HTTP LAN URLs won't work.
//
// While testing on a phone against a locally-running backend, AR loads the
// /artryon/index.html WebView through an ngrok HTTPS tunnel to that same
// backend. Product images don't depend on this — they're served directly
// from Cloudinary URLs stored on each product — so only the AR page routes
// through the tunnel. Override via EXPO_PUBLIC_AR_URL in .env when the
// tunnel URL changes.
const AR_DEV_TUNNEL = "https://lifting-manpower-corral.ngrok-free.dev";

export const AR_BASE_URL_OVERRIDE = process.env.EXPO_PUBLIC_AR_URL || "";

const isHttps = (u) => typeof u === "string" && u.startsWith("https://");

export const AR_BASE_URL = AR_BASE_URL_OVERRIDE
  || (__DEV__ ? AR_DEV_TUNNEL : (isHttps(BASE_URL) ? BASE_URL : ""));

export const AR_IS_AVAILABLE = !!AR_BASE_URL;

if (__DEV__) {
  console.log("[api/config] BASE_URL =", BASE_URL, "| devHost =", devHost);
  console.log("[api/config] AR_BASE_URL =", AR_BASE_URL || "(disabled — needs HTTPS)");
}

export const API_HEADERS = {
  "Content-Type": "application/json",
};
