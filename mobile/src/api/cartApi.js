import { Platform } from "react-native";

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://lifting-manpower-corral.ngrok-free.dev";

// 🔥 GET CART
export const getCart = async (token) => {
  const res = await fetch(`${BASE_URL}/getcart`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "auth-token": token,
    },
    body: JSON.stringify({}),
  });

  return res.json();
};

// ➕ ADD
export const addToCartAPI = async (token, itemId, size) => {
  const res = await fetch(`${BASE_URL}/addtocart`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "auth-token": token,
    },
    body: JSON.stringify({ itemId, size }),
  });

  return res.json();
};

// ➖ REMOVE
export const removeFromCartAPI = async (token, itemId, size) => {
  const res = await fetch(`${BASE_URL}/removefromcart`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "auth-token": token,
    },
    body: JSON.stringify({ itemId, size }),
  });

  return res.json();
};