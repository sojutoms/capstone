import { Platform } from "react-native";

const IS_WEB = Platform.OS === "web";

export const BASE_URL = IS_WEB
  ? "http://localhost:4000"
  : "https://lifting-manpower-corral.ngrok-free.dev";

// Only send ngrok header on native — sending it on web causes CORS preflight to fail
export const API_HEADERS = {
  "Content-Type": "application/json",
  ...(IS_WEB ? {} : { "ngrok-skip-browser-warning": "true" }),
};