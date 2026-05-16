import React, { useContext, useState, useEffect, useCallback } from "react";
import "./CartItems.css";
import { ShopContext } from "../../Context/ShopContext";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "../../services/api";

const SIMPLE_CATEGORIES = ["watch", "bags", "collectibles"];

const CartItems = () => {
  const { all_product, cartItems, removeFromCart, addToCart } = useContext(ShopContext);
  const navigate = useNavigate();

  const [stockIssues, setStockIssues] = useState({});
  const [canCheckout, setCanCheckout] = useState(true);
  const [validating, setValidating] = useState(false);

  const formatPrice = (price) => {
    const num = Number(price);
    if (!Number.isFinite(num)) return "0.00";
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

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

  const getAvailableStock = (product, size) => {
    if (!product) return 0;
    const isSimple = product.category && SIMPLE_CATEGORIES.includes(String(product.category).toLowerCase());
    if (isSimple) return Math.max(0, Number(product.stock || 0));

    const targetSize = String(size || "").trim();
    if (Array.isArray(product.sizes)) {
      const sizeData = product.sizes.find(s => {
        const sSize = String(s.size || "").trim();
        return sSize === targetSize || (parseFloat(sSize) === parseFloat(targetSize) && !isNaN(parseFloat(targetSize)));
      });
      if (sizeData) return Math.max(0, Number(sizeData.quantity || 0));
    } else if (product.sizes && typeof product.sizes === "object") {
      const sizeData = product.sizes[size] || product.sizes[targetSize];
      const q = typeof sizeData === "object" ? sizeData.quantity : sizeData;
      return Number.isFinite(Number(q)) ? Math.max(0, Number(q)) : 0;
    }
    return 0;
  };




  const cartItemsArray = Object.entries(cartItems).filter(([key, quantity]) => {
    if (!quantity || quantity <= 0) return false;
    const [productId] = key.split("_");
    const product = all_product.find((p) => p.id === Number(productId));
    return Boolean(product);
  });

  // ✅ Depend on cartItems + all_product (the stable sources), not cartItemsArray
  // which is re-derived on every render and would cause an infinite loop.
  const validateCart = useCallback(async () => {
    const token = localStorage.getItem("auth-token");

    // Re-derive inside the callback so we always have the latest snapshot
    const currentItems = Object.entries(cartItems).filter(([key, quantity]) => {
      if (!quantity || quantity <= 0) return false;
      const [productId] = key.split("_");
      return Boolean(all_product.find((p) => p.id === Number(productId)));
    });

    if (!token || currentItems.length === 0) {
      setStockIssues({});
      setCanCheckout(true);
      return;
    }
    setValidating(true);
    try {
      const items = currentItems.map(([key, quantity]) => {
        const [productId, sizeToken] = key.split("_");
        const normalizedSize = sizeToken === "null" || sizeToken === "undefined" ? "" : sizeToken;
        return { id: Number(productId), size: normalizedSize, quantity };
      });
      const res = await fetch(`${API_BASE_URL}/validate-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-token": token },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (data.success) {
        const issues = {};
        data.results.forEach((r) => {
          if (!r.available) issues[`${r.id}_${r.size}`] = r.reason || "Out of stock";
        });
        setStockIssues(issues);
        setCanCheckout(data.allAvailable);
      }
    } catch (err) {
      console.error("validateCart error:", err);
    } finally {
      setValidating(false);
    }
  }, [cartItems, all_product]); // ✅ stable source deps only

  useEffect(() => {
    validateCart();
  }, [validateCart]);

  const handleIncrement = (productId, size) => {
    const product = all_product.find((p) => p.id === Number(productId));
    if (!product) return;
    const normalizedSize = size === "null" || size === "undefined" || size === "" ? "" : size;
    const key = `${productId}_${normalizedSize}`;
    const availableStock = getAvailableStock(product, normalizedSize);
    const currentQuantity = cartItems[key] || 0;
    if (availableStock <= 0) { alert("Out of stock."); return; }
    if (currentQuantity >= availableStock) { alert(`Max stock reached.`); return; }
    addToCart(Number(productId), normalizedSize || null);
  };

  const calculateCartTotal = () => {
    let total = 0;
    for (const [key, quantity] of Object.entries(cartItems)) {
      if (!quantity || quantity <= 0) continue;
      const [productId, sizeToken] = key.split("_");
      const product = all_product.find((p) => p.id === Number(productId));
      if (!product) continue;
      const normalizedSize = sizeToken === "null" || sizeToken === "undefined" ? "" : sizeToken;
      if (stockIssues[`${productId}_${normalizedSize}`]) continue;
      const price = getSizePrice(product, normalizedSize);
      total += (Number(price) || 0) * quantity;
    }
    return total;
  };

  const renderItem = (key, quantity, isOos = false) => {
    const [productId, sizeToken] = key.split("_");
    const product = all_product.find((p) => p.id === Number(productId));
    if (!product) return null;

    const normalizedSize = sizeToken === "null" || sizeToken === "undefined" ? "" : sizeToken;
    const availableStock = getAvailableStock(product, normalizedSize);
    const sizePrice = getSizePrice(product, normalizedSize);
    const remaining = Math.max(0, availableStock - quantity);

    return (
      <div key={key} className={`cart-item-innovative${isOos ? " cart-item--oos" : ""}`}>
        <div className={`cart-image-zone${isOos ? " cart-image-zone--faded" : ""}`}>
          <img src={product.image} alt={product.name} />
          {isOos && <div className="oos-image-overlay">OUT OF STOCK</div>}
        </div>

        <div className={`cart-info-zone${isOos ? " cart-info-zone--faded" : ""}`}>
          <div className="cart-info-header">
            <h3>{product.name}</h3>
            {!isOos && availableStock > 0 && availableStock <= 5 && (
              <span className="stock-warning-badge">
                {remaining === 0 ? "LAST ITEM" : `ONLY ${remaining} LEFT`}
              </span>
            )}
          </div>
          <div className="spec-grid">
            {!SIMPLE_CATEGORIES.includes(String(product.category).toLowerCase()) && (
              <div className="spec-item">
                <span className="spec-label">Size (US)</span>
                <span className="spec-value">{normalizedSize || "—"}</span>
              </div>
            )}
            <div className="spec-item">
              <span className="spec-label">Unit Price : </span>
              <span className="spec-value">₱{formatPrice(sizePrice)}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Subtotal : </span>
              <span className="spec-value">₱{formatPrice((Number(sizePrice) || 0) * quantity)}</span>
            </div>
          </div>
        </div>

        <div className="cart-action-zone">
          <button className="remove-strike-btn" onClick={() => removeFromCart(key)}>✕</button>
          {!isOos && (
            <div className="vertical-qty">
              <button onClick={() => handleIncrement(productId, normalizedSize)} disabled={quantity >= availableStock}>+</button>
              <span>{quantity}</span>
              <button onClick={() => removeFromCart(key)}>-</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const inStockItems = cartItemsArray.filter(([key]) => {
    const [productId, sizeToken] = key.split("_");
    const normalizedSize = sizeToken === "null" || sizeToken === "undefined" ? "" : sizeToken;
    return !stockIssues[`${productId}_${normalizedSize}`];
  });

  const outOfStockItems = cartItemsArray.filter(([key]) => {
    const [productId, sizeToken] = key.split("_");
    const normalizedSize = sizeToken === "null" || sizeToken === "undefined" ? "" : sizeToken;
    return Boolean(stockIssues[`${productId}_${normalizedSize}`]);
  });

  return (
    <div className="cart-page">
      {cartItemsArray.length === 0 ? (
        <div className="cart-empty-terminal content-fade-in">
          <div className="terminal-body">
            <h1 className="hero-title">YOUR CART<br />IS EMPTY</h1>
          </div>
          <div className="terminal-footer">
            <button className="return-shop-btn" onClick={() => navigate("/")}>
              Shop Now
            </button>
          </div>
        </div>
      ) : (
        <div className="cart-container">
          <div className="cart-left">
            <h1 className="cart-title">Your Cart</h1>
            {!canCheckout && (
              <div className="cart-stock-banner">
                ⚠ SOME ITEMS ARE UNAVAILABLE. PLEASE REMOVE THEM TO CHECKOUT.
              </div>
            )}
            <div className="cart-items-list">
              {inStockItems.map(([key, quantity]) => renderItem(key, quantity, false))}
              {outOfStockItems.length > 0 && (
                <div className="oos-section">
                  <div className="oos-section-header">
                    <div className="oos-section-line" />
                    <span className="oos-section-title">Out of Stock</span>
                    <div className="oos-section-line" />
                  </div>
                  {outOfStockItems.map(([key, quantity]) => renderItem(key, quantity, true))}
                </div>
              )}
            </div>
          </div>

          <div className="cart-right">
            <div className="cart-summary">
              <h2 className="summary-title">Summary</h2>
              <div className="summary-row">
                <span>Subtotal</span>
                <span>₱{formatPrice(calculateCartTotal())}</span>
              </div>
              <div className="summary-row">
                <span>Delivery</span>
                <span>FREE</span>
              </div>
              <div className="summary-divider"></div>
              <div className="summary-total">
                <span>Total</span>
                <span>₱{formatPrice(calculateCartTotal())}</span>
              </div>
              <button
                className="checkout-button"
                onClick={() => navigate("/place-order")}
                disabled={!canCheckout || validating}
              >
                {validating ? "VALIDATING..." : "PROCEED TO CHECKOUT"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartItems;
