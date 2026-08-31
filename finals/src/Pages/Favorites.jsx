import React, { useContext, useEffect, useState } from "react";
import { FavoritesContext } from "../Context/FavoritesContext";
import { ShopContext } from "../Context/ShopContext";
import Item from "../Components/Item/Item";
import "./CSS/Favorites.css";

const ITEMS_PER_PAGE = 12;

const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[,₱$€£\s]+/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }
  if (typeof v === "object") {
    if (v.price !== undefined) return toNumber(v.price);
    if (v.new_price !== undefined) return toNumber(v.new_price);
    if (v.amount !== undefined) return toNumber(v.amount);
    if (v.value !== undefined) return toNumber(v.value);
  }
  return NaN;
};

const extractPriceFromMap = (mapLike) => {
  if (!mapLike || typeof mapLike !== "object") return NaN;
  const vals = Object.values(mapLike).flatMap((v) => {
    if (v === null || v === undefined) return [];
    if (typeof v === "object") {
      const p = toNumber(v.price ?? v.new_price ?? v.amount ?? v.value);
      return Number.isFinite(p) ? [p] : [];
    }
    const p = toNumber(v);
    return Number.isFinite(p) ? [p] : [];
  });
  return vals.length ? Math.min(...vals) : NaN;
};

const resolveBestPrice = (item) => {
  if (!item) return NaN;

  if (Array.isArray(item.sizes) && item.sizes.length > 0) {
    const prices = item.sizes
      .map((s) => (s && typeof s === "object" ? toNumber(s.price ?? s.new_price ?? s.amount ?? s.value) : toNumber(s)))
      .filter(Number.isFinite);
    if (prices.length > 0) return Math.min(...prices);
  }

  if (item.sizes && typeof item.sizes === "object") {
    const p = extractPriceFromMap(item.sizes);
    if (Number.isFinite(p)) return p;
  }

  if (item.price_map && typeof item.price_map === "object") {
    const p = extractPriceFromMap(item.price_map);
    if (Number.isFinite(p)) return p;
  }

  const topCandidates = [item.new_price, item.price, item.price_php, item.amount, item.value];
  for (const c of topCandidates) {
    const n = toNumber(c);
    if (Number.isFinite(n) && n > 0) return n;
  }

  if (typeof item.price === "object") {
    const p = extractPriceFromMap(item.price);
    if (Number.isFinite(p)) return p;
  }

  return NaN;
};


const Favorites = () => {
  const { favorites, clearFavorites } = useContext(FavoritesContext);
  const { all_product } = useContext(ShopContext);
  const [currentPage, setCurrentPage] = useState(1);

  const favSet = new Set(favorites.map((f) => String(f)));
  const favoriteProducts = Array.isArray(all_product)
    ? all_product.filter((product) => favSet.has(String(product.id)))
    : [];

  const totalPages = Math.max(1, Math.ceil(favoriteProducts.length / ITEMS_PER_PAGE));

  // Clamp back to a valid page if items were removed (e.g. unfavorited)
  // while on a later page that no longer exists.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  if (!Array.isArray(all_product) || all_product.length === 0) {
    return (
      <div className="favorites-page">
        <div className="favorites-container">
          <div className="favorites-header">
            <div>
              <h1 className="favorites-title">My Favorites</h1>
              <p className="favorites-subtitle">
                {favorites.length} {favorites.length === 1 ? "item" : "items"} saved
              </p>
            </div>
          </div>
          <div className="loading-state">Loading products...</div>
        </div>
      </div>
    );
  }

  const pageProducts = favoriteProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="favorites-page">
      <div className="favorites-container">
        {/* Header */}
        <div className="favorites-header">
          <div>
            <h1 className="favorites-title">My Favorites</h1>
            <p className="favorites-subtitle">
              {favorites.length} {favorites.length === 1 ? "item" : "items"} saved
            </p>
          </div>
          {favorites.length > 0 && (
            <button className="clear-all-btn" onClick={clearFavorites}>
              Clear All
            </button>
          )}
        </div>

        {/* Empty State */}
        {favoriteProducts.length === 0 ? (
          <div className="favorites-empty">
            <div className="empty-icon">
              <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <h2 className="empty-title">Your favorites list is empty</h2>
            <p className="empty-description">
              Start adding items to your favorites by clicking the heart icon on products you love!
            </p>
            <a href="/shoes" className="shop-now-btn">
              Continue Shopping
            </a>
          </div>
        ) : (
          <>
            {/* Products Grid */}
            <div className="favorites-grid">
              {pageProducts.map((item) => {
                const numericPrice = resolveBestPrice(item);
                return (
                  <Item
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    image={item.image}
                    sizes={item.sizes || item.variants || item.price_map}
                    price={Number.isFinite(numericPrice) ? numericPrice : undefined}
                    new_price={item.new_price}
                    old_price={item.old_price}
                    isNew={item.isNew}
                    salesCount={item.salesCount || 0}
                    // Optionally pass formatted price if Item expects a string:
                    // formattedPrice={Number.isFinite(numericPrice) ? `₱${formatPrice(numericPrice)}` : null}
                  />
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="favorites-pagination">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>PREV</button>
                <span>{currentPage} / {totalPages}</span>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>NEXT</button>
              </div>
            )}
          </>
        )}

        {/* Info Section */}
        {favorites.length > 0 && (
          <div className="favorites-info">
            <div className="info-card">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <div>
                <h3>Save for Later</h3>
                <p>Items stay in your favorites until you remove them</p>
              </div>
            </div>
            <div className="info-card">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <div>
                <h3>Quick Add to Cart</h3>
                <p>Easily move items from favorites to your cart</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;
