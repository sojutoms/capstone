import React, { useEffect, useState, useCallback } from "react";
import "./Popular.css";
import Item from "../Item/Item";
import Skeleton from "../Skeleton/Skeleton";
import API_BASE_URL from "../../services/api";

const useNumericPrice = () =>
  useCallback((item) => {
    if (!item) return undefined;

    // Handle sizes when it's an object (from backend)
    if (item.sizes && typeof item.sizes === "object" && !Array.isArray(item.sizes)) {
      const sizeValues = Object.values(item.sizes);
      if (sizeValues.length > 0) {
        const prices = sizeValues
          .filter((s) => s && typeof s === "object" && s.price !== undefined)
          .map((s) => Number(s.price))
          .filter((n) => Number.isFinite(n) && n > 0);
        if (prices.length > 0) return Math.min(...prices);
      }
    }

    // Handle sizes when it's an array (legacy format)
    if (Array.isArray(item.sizes) && item.sizes.length > 0) {
      const prices = item.sizes
        .map((s) => (s && typeof s === "object" ? Number(s.price) : Number(s)))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (prices.length > 0) return Math.min(...prices);
    }

    const candidates = [item.price, item.new_price, item.price_php, item.amount];
    for (const c of candidates) {
      const n = Number(c);
      if (Number.isFinite(n) && n > 0) return n;
    }

    // Use priceRange from backend if available
    if (item.priceRange && typeof item.priceRange === "object") {
      if (Number.isFinite(item.priceRange.min) && item.priceRange.min > 0) {
        return item.priceRange.min;
      }
    }

    return undefined;
  }, []);

const Popular = () => {
  const [popularProducts, setPopularProducts] = useState([]);
  const resolvePrice = useNumericPrice();

  useEffect(() => {
    fetch(`${API_BASE_URL}/featured`)
      .then((response) => response.json())
      .then((data) => setPopularProducts(data))
      .catch((error) => console.error("Error fetching featured products:", error));
  }, []);

  return (
    <div className="popular-container">
      <div className="popular">

        <div className="popular-header">
          <div className="section-label">— Hand Picked</div>
          <h1>Featured</h1>
          <div className="section-divider">
            <div className="section-divider-line" />
            <div className="section-divider-dot" />
          </div>
        </div>

        <div className="popular-item">
          {popularProducts.length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} />)
          ) : (
            popularProducts.map((item, i) => {
              const resolvedPrice = resolvePrice(item);
              return (
                <Item
                  key={i}
                  id={item.id}
                  name={item.name}
                  image={item.image}
                  sizes={item.sizes || item.variants || item.price_map}
                  price={resolvedPrice}
                  new_price={item.new_price}
                  old_price={item.old_price}
                  salesCount={item.salesCount}
                />
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};

export default Popular;
