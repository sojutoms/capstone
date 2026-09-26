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
// iOS/WebKit and Android WebView both only expose on HTTPS (or localhost).
//
// Whenever BASE_URL is HTTPS (the default — points at the deployed backend),
// AR uses it directly. If someone flips EXPO_PUBLIC_API_URL to a plain-HTTP
// LAN backend for local backend work, they can also set EXPO_PUBLIC_AR_URL
// to an HTTPS tunnel URL just for the AR page.
export const AR_BASE_URL_OVERRIDE = process.env.EXPO_PUBLIC_AR_URL || "";

const isHttps = (u) => typeof u === "string" && u.startsWith("https://");

export const AR_BASE_URL = AR_BASE_URL_OVERRIDE
  || (isHttps(BASE_URL) ? BASE_URL : "");

export const AR_IS_AVAILABLE = !!AR_BASE_URL;

if (__DEV__) {
  console.log("[api/config] BASE_URL =", BASE_URL, "| devHost =", devHost);
  console.log("[api/config] AR_BASE_URL =", AR_BASE_URL || "(disabled — needs HTTPS)");
}

export const API_HEADERS = {
  "Content-Type": "application/json",
};
