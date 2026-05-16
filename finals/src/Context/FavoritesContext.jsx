import React, { createContext, useState, useEffect, useCallback } from "react";
import API_BASE_URL from "../services/api";

export const FavoritesContext = createContext();

export const FavoritesProvider = ({ children }) => {
  const [favorites, setFavorites] = useState([]);

  const normalize = (arr) => (Array.isArray(arr) ? arr.map((id) => String(id)) : []);

  const loadFavorites = useCallback(async () => {
    const token = localStorage.getItem("auth-token");
    if (!token) { setFavorites([]); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/userfavorites`, {
        headers: { "auth-token": token },
      });
      const data = await res.json();
      if (data && data.success) setFavorites(normalize(data.favorites || []));
      else {
        console.warn("loadFavorites: unexpected response", data);
        setFavorites(normalize(data.favorites || []));
      }
    } catch (err) {
      console.error("Failed to load favorites", err);
    }
  }, []);

  const addToFavorites = async (productId) => {
    const token = localStorage.getItem("auth-token");
    if (!token) return { success: false, error: "no-token" };
    const idStr = String(productId);

    // Optimistic update
    setFavorites((prev) => (prev.includes(idStr) ? prev : [...prev, idStr]));

    try {
      const res = await fetch(`${API_BASE_URL}/addfavorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-token": token },
        body: JSON.stringify({ productId: idStr }),
      });
      const data = await res.json();
      if (data && data.success) {
        setFavorites(normalize(data.favorites || []));
        return { success: true };
      } else {
        // Revert optimistic update
        setFavorites((prev) => prev.filter((id) => id !== idStr));
        console.warn("addToFavorites failed:", data);
        return { success: false, error: data?.message || "server-failed", payload: data };
      }
    } catch (err) {
      // Revert optimistic update
      setFavorites((prev) => prev.filter((id) => id !== idStr));
      console.error("Failed to add favorite", err);
      return { success: false, error: err.message || "network-error" };
    }
  };

  const removeFromFavorites = async (productId) => {
    const token = localStorage.getItem("auth-token");
    if (!token) return { success: false, error: "no-token" };
    const idStr = String(productId);

    // Optimistic update: remove locally first
    const previous = favorites;
    setFavorites((prev) => prev.filter((id) => id !== idStr));

    try {
      const res = await fetch(`${API_BASE_URL}/removefavorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-token": token },
        body: JSON.stringify({ productId: idStr }),
      });
      const data = await res.json();
      if (data && data.success) {
        setFavorites(normalize(data.favorites || []));
        return { success: true };
      } else {
        // Revert optimistic update
        setFavorites(normalize(previous || []));
        console.warn("removeFromFavorites failed:", data);
        return { success: false, error: data?.message || "server-failed", payload: data };
      }
    } catch (err) {
      // Revert optimistic update
      setFavorites(normalize(previous || []));
      console.error("Failed to remove favorite", err);
      return { success: false, error: err.message || "network-error" };
    }
  };

  const clearFavorites = async () => {
    const token = localStorage.getItem("auth-token");
    if (!token) return { success: false, error: "no-token" };
    try {
      const res = await fetch(`${API_BASE_URL}/clearfavorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-token": token },
      });
      const data = await res.json();
      if (data && data.success) {
        setFavorites([]);
        return { success: true };
      } else {
        console.warn("clearFavorites failed:", data);
        return { success: false, error: data?.message || "server-failed", payload: data };
      }
    } catch (err) {
      console.error("Failed to clear favorites", err);
      return { success: false, error: err.message || "network-error" };
    }
  };

  const toggleFavorite = async (productId) => {
    const idStr = String(productId);
    if (favorites.includes(idStr)) return removeFromFavorites(productId);
    return addToFavorites(productId);
  };

  const isFavorite = (productId) => favorites.includes(String(productId));

  useEffect(() => {
    loadFavorites();
    window.addEventListener("auth-token-changed", loadFavorites);
    return () => window.removeEventListener("auth-token-changed", loadFavorites);
  }, [loadFavorites]);

  return (
    <FavoritesContext.Provider
      value={{ favorites, addToFavorites, removeFromFavorites, toggleFavorite, clearFavorites, isFavorite }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export default FavoritesProvider;
