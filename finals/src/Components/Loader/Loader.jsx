import React from 'react';
import './Loader.css';

const Loader = () => {
  return (
    <div className="luxe-loader-container">
      <div className="luxe-loader-content">
        <div className="luxe-loader-logo">GOODSOLES.PH</div>
        <div className="luxe-loader-bar">
          <div className="luxe-loader-progress"></div>
        </div>
      </div>
    </div>
  );
};

export default Loader;
