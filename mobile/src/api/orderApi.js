import { Platform } from "react-native";

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://unlaboured-charise-unmachined.ngrok-free.dev"; // 🔥 change to your IP

// 🔹 GET ADDRESSES
export const getSavedAddresses = async (token) => {
  const res = await fetch(`${BASE_URL}/getsavedaddresses`, {
    headers: {
      "auth-token": token,
    },
  });

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    console.log("NOT JSON:", text);
    return { success: false };
  }
};

// 🔹 SAVE ADDRESS
export const saveAddressAPI = async (token, address) => {
  const res = await fetch(`${BASE_URL}/saveaddress`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "auth-token": token,
    },
    body: JSON.stringify({ address }),
  });

  return res.json();
};

// 🔹 PLACE ORDER
export const placeOrderAPI = async (token, payload) => {
  const res = await fetch(`${BASE_URL}/placeorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "auth-token": token,
    },
    body: JSON.stringify(payload),
  });

  return res.json();
};