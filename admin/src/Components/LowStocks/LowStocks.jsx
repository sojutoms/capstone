import React from "react";

const LowStocks = ({ products }) => {
  if (!Array.isArray(products)) return null; // or show a loading message

  return (
    <div className="alert-card">
      <h3>Low Stock Alerts</h3>
      {products.length === 0 ? (
        <p>All products are sufficiently stocked.</p>
      ) : (
        <ul className="low-stock-list">
          {products.map(p => (
            <li key={`${p.id}-${p.size}`}>...
              <strong>{p.name}</strong> — Size {p.size} has only {p.quantity} left
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LowStocks;
