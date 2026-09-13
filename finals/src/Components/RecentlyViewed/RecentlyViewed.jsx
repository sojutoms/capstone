import React, { useContext, useEffect, useState } from "react";
import "./RecentlyViewed.css";
import Item from "../Item/Item";
import { ShopContext } from "../../Context/ShopContext";

const RecentlyViewed = ({ currentProductId }) => {
  const { all_product } = useContext(ShopContext);
  const [recentProducts, setRecentProducts] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem("recentlyViewed");
    let viewedList = stored ? JSON.parse(stored) : [];

    if (currentProductId) {
      viewedList = viewedList.filter(p => p.id !== currentProductId);
    }

    const fresh = viewedList
      .map((entry) => all_product.find((p) => p.id === entry.id && !p.isDeleted))
      .filter(Boolean);

    setRecentProducts(fresh.slice(0, 4));
  }, [currentProductId, all_product]);

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
            isNew={item.isNew}
            isJustIn={item.isJustIn}
            isTopSellerInBrand={item.isTopSellerInBrand}
          />
        ))}
      </div>
    </div>
  );
};

export default RecentlyViewed;
