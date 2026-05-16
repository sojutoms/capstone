import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./RecentlyViewed.css";
import Item from "../Item/Item";

const RecentlyViewed = ({ currentProductId }) => {
  const [recentProducts, setRecentProducts] = useState([]);

  useEffect(() => {
    // Get existing recently viewed from localStorage
    const stored = localStorage.getItem("recentlyViewed");
    let viewedList = stored ? JSON.parse(stored) : [];

    // Filter out current product if it's already there
    if (currentProductId) {
      viewedList = viewedList.filter(p => p.id !== currentProductId);
      // Add current product to the front (we'll fetch its full data from the main list if needed, 
      // but usually we store a minimal version)
    }

    setRecentProducts(viewedList.slice(0, 4));
  }, [currentProductId]);

  if (recentProducts.length === 0) return null;

  return (
    <div className="recently-viewed">
      <div className="recently-viewed-header">
        <span className="recently-viewed-line"></span>
        <h2>Recently Viewed</h2>
        <span className="recently-viewed-line"></span>
      </div>
      <div className="recently-viewed-grid">
        {recentProducts.map((item) => (
          <Item 
            key={item.id}
            id={item.id}
            name={item.name}
            image={item.image}
            new_price={item.new_price}
            price={item.price}
            sizes={item.sizes}
          />
        ))}
      </div>
    </div>
  );
};

export default RecentlyViewed;
