import React from 'react';
import './Skeleton.css';

const Skeleton = ({ type = "product" }) => {
  if (type === "product") {
    return (
      <div className="skeleton-card">
        <div className="skeleton-image shim"></div>
        <div className="skeleton-title shim"></div>
        <div className="skeleton-price shim"></div>
      </div>
    );
  }

  return <div className="skeleton-base shim"></div>;
};

export default Skeleton;
