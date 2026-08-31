import { Platform } from "react-native";

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://lifting-manpower-corral.ngrok-free.dev";

// 🔥 GET FAVORITES
export const getFavoritesAPI = async (token) => {
  const res = await fetch(`${BASE_URL}/userfavorites`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "auth-token": token,
    },
  });

  return res.json();
};

// ➕ ADD FAVORITE
export const addFavoriteAPI = async (token, productId) => {
  const res = await fetch(`${BASE_URL}/addfavorite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "auth-token": token,
    },
    body: JSON.stringify({ productId: String(productId) }),
  });

  return res.json();
};

// ➖ REMOVE FAVORITE
export const removeFavoriteAPI = async (token, productId) => {
  const res = await fetch(`${BASE_URL}/removefavorite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "auth-token": token,
    },
    body: JSON.stringify({ productId: String(productId) }),
  });

  return res.json();
};

// ❌ CLEAR ALL FAVORITES
export const clearFavoritesAPI = async (token) => {
  const res = await fetch(`${BASE_URL}/clearfavorites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "auth-token": token,
    },
    body: JSON.stringify({}),
  });

  return res.json();
};