// src/services/api.js
// ─────────────────────────────────────────────────────────────
// Vite uses import.meta.env — NOT process.env like CRA
// In development  → http://localhost:4000  (npm run dev)
// In production   → your Render URL       (npm run build)
// ─────────────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

/**
 * A wrapper around fetch that automatically:
 * 1. Prefixes relative URLs with API_BASE_URL
 * 2. Injects 'auth-token' and 'Authorization' headers from sessionStorage
 * 3. Handles 401 Unauthorized by clearing session and redirecting to login
 */
export const authorizedFetch = async (url, options = {}) => {
  const token = sessionStorage.getItem("admin-token");
  
  // 1. Resolve full URL
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;

  // 2. Prepare headers
  const headers = {
    ...options.headers,
  };

  // Only add Content-Type if it's not FormData (which needs to set its own boundary)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  if (token) {
    headers["auth-token"] = token;
    headers["Authorization"] = `Bearer ${token}`;
  }

  // 3. Execute fetch
  const response = await fetch(fullUrl, { ...options, headers });

  // 4. Global 401 handling
  if (response.status === 401) {
    console.warn("[authorizedFetch] 401 Unauthorized detected. Redirecting to login...");
    sessionStorage.removeItem("admin-token");
    sessionStorage.removeItem("admin-roles");
    sessionStorage.removeItem("admin-name");
    // Only redirect if we are not already on the login page to avoid loops
    if (!window.location.pathname.includes("/admin/login")) {
      window.location.href = "/admin/login";
    }
  }

  return response;
};

export default API_BASE_URL;