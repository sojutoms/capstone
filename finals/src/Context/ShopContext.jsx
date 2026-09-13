import React, { createContext, useEffect, useState } from "react";
import API_BASE_URL from "../services/api";
import { showToast } from "../utils/toast";

export const ShopContext = createContext(null);

const ShopContextProvider = (props) => {
  const [all_product, setAll_Product] = useState([]);
  const [cartItems, setCartItems] = useState(() => {
    if (localStorage.getItem("auth-token")) return {};
    try {
      const saved = localStorage.getItem("cartItems");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [cartSizes, setCartSizes] = useState(() => {
    if (localStorage.getItem("auth-token")) return {};
    try {
      const saved = localStorage.getItem("cartSizes");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  useEffect(() => {
    localStorage.setItem("cartItems", JSON.stringify(cartItems));
    localStorage.setItem("cartSizes", JSON.stringify(cartSizes));
  }, [cartItems, cartSizes]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const productRes  = await fetch(`${API_BASE_URL}/allproducts`);
        const productData = await productRes.json();

        const activeProducts = (Array.isArray(productData) ? productData : [])
          .filter((p) => !p.isDeleted);

        setAll_Product(activeProducts);
      } catch (err) {
        console.error("Failed to fetch products:", err);
        setAll_Product([]);
      } finally {
        setIsLoadingProducts(false);
      }

      const token = localStorage.getItem("auth-token");

      if (token) {
        try {
          const cartRes  = await fetch(`${API_BASE_URL}/getcart`, {
            method: "POST",
            headers: {
              Accept:           "application/json",
              "auth-token":     token,
              "Content-Type":   "application/json",
            },
            body: JSON.stringify({}),
          });
          const cartData = await cartRes.json();

          const backendCart  = {};
          const backendSizes = {};
          cartData.forEach(({ itemId, size, quantity }) => {
            const key           = `${itemId}_${size}`;
            backendCart[key]    = quantity;
            backendSizes[key]   = size;
          });

          setCartItems(backendCart);
          setCartSizes(backendSizes);
        } catch (err) {
          console.error("Failed to fetch cart from backend:", err);
        }
      }
    };

    fetchData();
  }, []);

  const addToCart = async (itemId, size) => {
    const key   = `${itemId}_${size}`;
    const token = localStorage.getItem("auth-token");

    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}/addtocart`, {
          method: "POST",
          headers: {
            Accept:           "application/json",
            "auth-token":     token,
            "Content-Type":   "application/json",
          },
          body: JSON.stringify({ itemId: Number(itemId), size }),
        });
        const data = await response.json();

        if (data.success) {
          setCartItems((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
          setCartSizes((prev) => ({ ...prev, [key]: size }));
        } else {
          showToast("error", data.error || data.message || "Failed to add to cart.");
        }
      } catch (err) {
        console.error("Failed to sync cart with backend:", err);
        showToast("error", "Error adding to cart. Please try again.");
      }

    } else {
      const product = all_product.find((p) => p.id === Number(itemId));
      if (!product) { showToast("error", "Product not found"); return; }

      let availableStock = 0;
      const targetSize = String(size || "").trim();
      
      if (Array.isArray(product.sizes)) {
        const sizeEntry = product.sizes.find(s => {
          const sSize = String(s.size || "").trim();
          return sSize === targetSize || (parseFloat(sSize) === parseFloat(targetSize) && !isNaN(parseFloat(targetSize)));
        });
        availableStock = sizeEntry ? Number(sizeEntry.quantity || 0) : Number(product.stock || 0);
      } else if (product.sizes && typeof product.sizes === "object") {
        const sizeEntry = product.sizes[size] || product.sizes[targetSize];
        availableStock = typeof sizeEntry === "object" ? Number(sizeEntry.quantity || 0) : Number(sizeEntry || product.stock || 0);
      } else {
        availableStock = Number(product.stock || 0);
      }



      const currentQtyInCart = cartItems[key] || 0;

      if (currentQtyInCart + 1 > availableStock) {
        showToast("error", `Only ${availableStock} item(s) available in size ${size}. You already have ${currentQtyInCart} in your cart.`);
        return;
      }

      setCartItems((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
      setCartSizes((prev) => ({ ...prev, [key]: size }));
      showToast("success", "Product added to cart!");
    }
  };

  const removeFromCart = async (key) => {
    const token = localStorage.getItem("auth-token");
    const willDelete = (cartItems[key] || 0) <= 1;

    if (token) {
      const [itemId, size] = key.split("_");
      try {
        const res  = await fetch(`${API_BASE_URL}/removefromcart`, {
          method: "POST",
          headers: {
            Accept:           "application/json",
            "auth-token":     token,
            "Content-Type":   "application/json",
          },
          body: JSON.stringify({ itemId: Number(itemId), size }),
        });
        const data = await res.json();

        if (data.success) {
          setCartItems((prev) => {
            const updated = { ...prev };
            if (updated[key] > 1) updated[key] -= 1;
            else delete updated[key];
            return updated;
          });
          setCartSizes((prev) => {
            const updated = { ...prev };
            if (willDelete) delete updated[key];
            return updated;
          });
        } else {
          console.error("Backend failed to remove item:", data.error);
          showToast("error", data.error || "Failed to remove from cart");
        }
      } catch (err) {
        console.error("Failed to sync cart removal:", err);
        showToast("error", "Error removing from cart. Please try again.");
      }
    } else {
      setCartItems((prev) => {
        const updated = { ...prev };
        if (updated[key] > 1) updated[key] -= 1;
        else delete updated[key];
        return updated;
      });
      setCartSizes((prev) => {
        const updated = { ...prev };
        if (willDelete) delete updated[key];
        return updated;
      });
    }
  };

  const clearCart = async () => {
    const token = localStorage.getItem("auth-token");
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/clearcart`, {
          method: "POST",
          headers: {
            Accept:           "application/json",
            "auth-token":     token,
            "Content-Type":   "application/json",
          },
          body: JSON.stringify({}),
        });
      } catch (err) {
        console.error("Failed to clear cart on backend:", err);
      }
    }
    setCartItems({});
    setCartSizes({});
    localStorage.removeItem("cartItems");
    localStorage.removeItem("cartSizes");
  };

  const SIMPLE_CATEGORIES = ["bags", "collectibles"];

  const getSizePrice = (product, size) => {
    if (!product) return 0;
    const isSimple = product.category && SIMPLE_CATEGORIES.includes(String(product.category).toLowerCase());
    if (isSimple) return Number(product.price ?? product.new_price ?? 0) || 0;
    
    const targetSize = String(size || "").trim();
    if (Array.isArray(product.sizes)) {
      const sizeData = product.sizes.find(s => {
        const sSize = String(s.size || "").trim();
        return sSize === targetSize || (parseFloat(sSize) === parseFloat(targetSize) && !isNaN(parseFloat(targetSize)));
      });
      if (sizeData) return Number(sizeData.price) || 0;
    } else if (product.sizes && typeof product.sizes === "object") {
      const sizeData = product.sizes[size] || product.sizes[targetSize];
      if (typeof sizeData === "object") return Number(sizeData.price) || 0;
      if (typeof sizeData === "number") return sizeData;
    }
    return Number(product.new_price ?? product.price ?? 0) || 0;
  };

  const getTotalCartAmount = () => {
    let total = 0;
    for (const key in cartItems) {
      const quantity          = cartItems[key];
      const [productId, size] = key.split("_");
      const product           = all_product.find((p) => p.id === Number(productId));
      if (!product) continue;

      const unitPrice = getSizePrice(product, size);
      total += unitPrice * quantity;
    }
    return total;
  };

  const getTotalCartItems = () =>
    Object.values(cartItems).reduce((sum, qty) => sum + qty, 0);

  const contextValue = {
    getTotalCartItems,
    getTotalCartAmount,
    all_product,
    cartItems,
    cartSizes,
    addToCart,
    removeFromCart,
    clearCart,
    isLoadingProducts,
  };

  return (
    <ShopContext.Provider value={contextValue}>
      {props.children}
    </ShopContext.Provider>
  );
};

export default ShopContextProvider;
