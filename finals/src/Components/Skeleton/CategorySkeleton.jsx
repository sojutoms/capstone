import React from "react";
import "./CategorySkeleton.css";

const CategorySkeleton = () => {
  return (
    <div className="category-skeleton-item">
      <div className="skeleton-image-wrapper">
        <div className="skeleton-shimmer"></div>
      </div>
      <div className="skeleton-info">
        <div className="skeleton-line skeleton-title"></div>
        <div className="skeleton-line skeleton-meta"></div>
        <div className="skeleton-line skeleton-price"></div>
      </div>
    </div>
  );
};

export default CategorySkeleton;
