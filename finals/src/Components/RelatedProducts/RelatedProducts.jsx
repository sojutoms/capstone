import React, { useState, useEffect } from "react";
import "./RelatedProducts.css";
import Item from "../Item/Item";
import { Link } from "react-router-dom";
import API_BASE_URL from "../../services/api";

// Reads subCategory from whichever field the backend uses —
// matches the same logic ShopCategory uses for its filter.
const getSubCategories = (item) => {
  if (Array.isArray(item?.subCategories) && item.subCategories.length > 0)
    return item.subCategories;
  if (item?.subCategory) return [item.subCategory];
  if (item?.sub_category) return [item.sub_category];
  return [];
};

const RelatedProducts = ({ category, subCategory, currentProductId }) => {
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    fetch(`${API_BASE_URL}/allproducts`)
      .then((res) => res.json())
      .then((data) => {
        const normalizedSub = subCategory?.toLowerCase().trim();
        const normalizedCat = category?.toLowerCase().trim();

        const filtered = data.filter((item) => {
          if (item.id === currentProductId) return false;

          const itemSubs = getSubCategories(item);
          const itemCat = item.category?.toLowerCase().trim();

          // Primary: match any overlapping subCategory tag
          if (normalizedSub && itemSubs.length > 0) {
            return itemSubs.some((s) => s.toLowerCase().trim() === normalizedSub);
          }

          // Fallback: no subCategory on either side → match by category
          return itemCat === normalizedCat;
        });

        setRelatedProducts(filtered.slice(0, 4));
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching related products:", err);
        setLoading(false);
      });
  }, [category, subCategory, currentProductId]);

  // Build the "See All" link:
  // If we have a subCategory, link to that — otherwise fall back to the category page.
  const seeAllHref = subCategory
    ? `/${category}?sub=${encodeURIComponent(subCategory)}`
    : `/${category}`;

  return (
    <div className="relatedproducts">
      <h1>Related Products</h1>
      <hr />

      <div className="relatedproducts-item">
        {loading ? (
          <p>Loading...</p>
        ) : relatedProducts.length === 0 ? (
          <p>No related products found</p>
        ) : (
          relatedProducts.map((item, i) => (
            <Item
              key={i}
              id={item.id}
              name={item.name}
              image={item.image}
              sizes={item.sizes || item.variants || item.price_map}
              new_price={item.new_price}
              old_price={item.old_price}
            />
          ))
        )}
      </div>

      {!loading && relatedProducts.length > 0 && (
        <Link to={seeAllHref} className="see-all-button">
          See All
        </Link>
      )}
    </div>
  );
};

export default RelatedProducts;
