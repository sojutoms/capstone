import React, { createContext, useState, useContext, useEffect } from "react";
import { useAuth } from "./AuthContext";
import {
  getFavoritesAPI,
  addFavoriteAPI,
  removeFavoriteAPI,
  clearFavoritesAPI,
} from "../api/favoritesApi";
import { Platform } from "react-native";

const BASE_URL =
  Platform.OS === "web"
    ? "http://localhost:4000"
    : "https://lifting-manpower-corral.ngrok-free.dev";

const FavoritesContext = createContext();

export const useFavorites = () => useContext(FavoritesContext);

export const FavoritesProvider = ({ children }) => {
  const { userToken } = useAuth();
  const [favorites, setFavorites] = useState([]);

  // 🔁 LOAD FAVORITES + ENRICH WITH PRODUCT DATA — also exposed as
  // refreshFavorites so screens can re-pull this on focus (e.g. after
  // favoriting something from the web app).
  const loadFavorites = async () => {
    if (!userToken) {
      setFavorites([]);
      return;
    }

    try {
      const data = await getFavoritesAPI(userToken);

      // data.favorites is an array of productId strings (e.g. ["12", "45"])
      const favoriteIds = data?.favorites || [];

      if (!favoriteIds.length) {
        setFavorites([]);
        return;
      }

      // Fetch full product list and filter to favorites
      const res = await fetch(`${BASE_URL}/allproducts`);
      const products = await res.json();

      const enriched = favoriteIds
        .map((id) => products.find((p) => String(p.id) === String(id)))
        .filter(Boolean);

      setFavorites(enriched);
    } catch (err) {
      console.log("Favorites load error:", err);
      setFavorites([]);
    }
  };

  useEffect(() => { loadFavorites(); }, [userToken]);

  // ✅ CHECK IF A PRODUCT IS FAVORITED
  const isFavorite = (productId) => {
    return favorites.some((item) => String(item.id) === String(productId));
  };

  // ➕ ADD TO FAVORITES
  const addToFavorites = async (product) => {
    if (!userToken) return;

    // Prevent duplicates optimistically
    if (isFavorite(product.id)) return;

    try {
      const res = await addFavoriteAPI(userToken, product.id);

      if (res.success) {
        setFavorites((prev) => [...prev, product]);
      }
    } catch (err) {
      console.log("Add favorite error:", err);
    }
  };

  // ➖ REMOVE FROM FAVORITES
  const removeFromFavorites = async (productId) => {
    if (!userToken) return;

    try {
      const res = await removeFavoriteAPI(userToken, productId);

      if (res.success) {
        setFavorites((prev) =>
          prev.filter((item) => String(item.id) !== String(productId))
        );
      }
    } catch (err) {
      console.log("Remove favorite error:", err);
    }
  };

  // 🔄 TOGGLE FAVORITE (used by the heart button in ProductDetailScreen)
  const toggleFavorite = async (productId) => {
    if (!userToken) return;

    if (isFavorite(productId)) {
      await removeFromFavorites(productId);
    } else {
      // We only have the id here — fetch the full product from current state if available
      // ProductDetailScreen passes the full product, but toggleFavorite only gets the id.
      // For the toggle, we just fire the API and update the id-based check.
      try {
        const res = await addFavoriteAPI(userToken, productId);
        if (res.success) {
          // Fetch fresh product data to enrich the favorites list
          const productRes = await fetch(`${BASE_URL}/allproducts`);
          const products = await productRes.json();
          const product = products.find((p) => String(p.id) === String(productId));
          if (product) {
            setFavorites((prev) => [...prev, product]);
          }
        }
      } catch (err) {
        console.log("Toggle favorite error:", err);
      }
    }
  };

  // ❌ CLEAR ALL FAVORITES
  const clearFavorites = async () => {
    if (!userToken) return;

    try {
      const res = await clearFavoritesAPI(userToken);

      if (res.success) {
        setFavorites([]);
      }
    } catch (err) {
      console.log("Clear favorites error:", err);
    }
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        isFavorite,
        addToFavorites,
        removeFromFavorites,
        toggleFavorite,
        clearFavorites,
        refreshFavorites: loadFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};