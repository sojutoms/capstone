import React, { createContext, useState, useContext, useEffect } from "react";
import { useAuth } from "./AuthContext";
import {
  getCart,
  addToCartAPI,
  removeFromCartAPI,
} from "../api/cartApi";
import { Platform, Alert } from "react-native";

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://unlaboured-charise-unmachined.ngrok-free.dev";

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const { userToken } = useAuth();
  const [cart, setCart] = useState([]);

  // 🔁 LOAD CART + PRODUCTS
  useEffect(() => {
    const loadCart = async () => {
      if (!userToken) {
        setCart([]);
        return;
      }

      try {
        const cartData = await getCart(userToken);

        const res = await fetch(`${BASE_URL}/allproducts`);
        const products = await res.json();

        const merged = cartData
          .map((c) => {
            const product = products.find(
              (p) => p.id === Number(c.itemId)
            );

            if (!product) return null;

            return {
              ...product,
              selectedSize: c.size,
              quantity: c.quantity,
            };
          })
          .filter(Boolean);

        setCart(merged);
      } catch (err) {
        console.log("Cart load error:", err);
        setCart([]);
      }
    };

    loadCart();
  }, [userToken]);

  // ➕ ADD WITH STOCK CHECK
  const addToCart = async (product, size) => {
    if (!userToken) return;

    const sizeData = product?.sizes?.[size];

    const availableStock =
      typeof sizeData === "object"
        ? sizeData.quantity
        : Number(sizeData) || 0;

    const existing = cart.find(
      (item) =>
        item.id === product.id &&
        item.selectedSize === size
    );

    const currentQty = existing?.quantity || 0;

    if (currentQty >= availableStock) {
      Alert.alert(
        "Stock Limit",
        `Maximum stock (${availableStock}) reached`
      );
      return;
    }

    try {
      const res = await addToCartAPI(userToken, product.id, size);

      if (res.success) {
        setCart((prev) => {
          const index = prev.findIndex(
            (item) =>
              item.id === product.id &&
              item.selectedSize === size
          );

          if (index !== -1) {
            const updated = [...prev];
            updated[index].quantity += 1;
            return updated;
          }

          return [
            ...prev,
            {
              ...product,
              selectedSize: size,
              quantity: 1,
            },
          ];
        });
      }
    } catch (err) {
      console.log("Add error:", err);
    }
  };

  // ➖ DECREASE
  const decreaseQuantity = async (index) => {
    if (!userToken) return;

    const item = cart[index];

    try {
      const res = await removeFromCartAPI(
        userToken,
        item.id,
        item.selectedSize
      );

      if (res.success) {
        setCart((prev) => {
          const updated = [...prev];

          if (updated[index].quantity > 1) {
            updated[index].quantity -= 1;
          } else {
            updated.splice(index, 1);
          }

          return updated;
        });
      }
    } catch (err) {
      console.log("Remove error:", err);
    }
  };

  // ❌ REMOVE single item
  const removeFromCart = async (index) => {
    if (!userToken) return;

    const item = cart[index];

    try {
      await removeFromCartAPI(
        userToken,
        item.id,
        item.selectedSize
      );

      setCart((prev) => prev.filter((_, i) => i !== index));
    } catch (err) {
      console.log("Remove error:", err);
    }
  };

  // 🗑️ CLEAR CART — remove all items after a successful order
  const clearCart = async () => {
    if (!userToken) {
      setCart([]);
      return;
    }

    try {
      // Call the backend clear-cart endpoint if you have one
      await fetch(`${BASE_URL}/clearcart`, {
        method: "POST",
        headers: {
          "auth-token": userToken,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      // Even if the API call fails, still clear locally
      console.log("clearCart API error (non-fatal):", err);
    } finally {
      setCart([]);
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        decreaseQuantity,
        removeFromCart,
        clearCart,        // ✅ now exported
      }}
    >
      {children}
    </CartContext.Provider>
  );
};