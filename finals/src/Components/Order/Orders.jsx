import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Orders.css';

const Orders = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    orderNumber = 'N/A',
    purchasedItems = [],
    discountAmount = 0,
    discountPercent = 0,
    voucherCode = null,
    shippingFee = 0,
    shippingTierLabel = '',
    codFee = 0,
    paymentMethod = '',
  } = location.state || {};

  const formatPrice = (val) =>
    Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const subtotal    = purchasedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount    = Number(discountAmount) || 0;
  const shipping    = Number(shippingFee) || 0;
  const cod         = Number(codFee) || 0;
  const total       = subtotal + shipping + cod - discount;
  const isCod       = paymentMethod === 'cash on delivery';
  const isFreeShip  = shipping === 0;

  return (
    <div className="confirmation-terminal">
      <div className="receipt-wrapper">
        <div className="holographic-stamp">
          <span>VERIFIED<br/>AUTHENTIC</span>
        </div>

        <header className="receipt-header">
          <div className="receipt-check">✓</div>
          <h1 className="receipt-title">Order Successful</h1>
          <div className="receipt-meta">
            <p>ID: <span className="highlight">{orderNumber}</span></p>
            <p>FINALIZED: {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </header>

        <main className="receipt-content">
          <h3>[ ITEM LOG ]</h3>

          {purchasedItems.length === 0 ? (
            <p className="empty-msg">No items found.</p>
          ) : (
            <div className="manifest-list">
              {purchasedItems.map((item, index) => (
                <div className="manifest-item" key={`${item.id}_${item.size}_${index}`}>
                  <div className="item-img-container">
                    <img src={item.image} alt={item.name} />
                  </div>
                  <div className="item-info">
                    <div className="item-header">
                      <h4>{item.name}</h4>
                      <span className="item-total">₱{formatPrice(item.price * item.quantity)}</span>
                    </div>
                    <div className="item-sub-meta">
                      <span>SIZE: {item.size || 'N/A'}</span>
                      <span className="separator">/</span>
                      <span>QTY: {item.quantity}</span>
                      <span className="separator">/</span>
                      <span>UNIT: ₱{formatPrice(item.price)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Order totals ── */}
          <div className="receipt-totals">

            <div className="receipt-totals-row">
              <span>Subtotal</span>
              <span>₱{formatPrice(subtotal)}</span>
            </div>

            {/* Shipping fee row */}
            <div className="receipt-totals-row">
              <span>
                Delivery / Shipping
                {shippingTierLabel && (
                  <span className="receipt-tier-badge"> {shippingTierLabel}</span>
                )}
              </span>
              {isFreeShip ? (
                <span className="receipt-free-badge">FREE</span>
              ) : (
                <span>₱{formatPrice(shipping)}</span>
              )}
            </div>

            {/* COD fee row */}
            {isCod && cod > 0 && (
              <div className="receipt-totals-row">
                <span>
                  COD Handling Fee
                  {shippingTierLabel && (
                    <span className="receipt-tier-badge">{shippingTierLabel}</span>
                  )}
                </span>
                <span>₱{formatPrice(cod)}</span>
              </div>
            )}

            {/* Voucher discount row */}
            {voucherCode && discount > 0 && (
              <div className="receipt-totals-row receipt-totals-row--discount">
                <span>
                  🏷 Voucher ({discountPercent}% off)
                  {' · '}<strong>{voucherCode}</strong>
                </span>
                <span>−₱{formatPrice(discount)}</span>
              </div>
            )}

            <div className="receipt-totals-row receipt-totals-row--total">
              <span>Total Paid</span>
              <span>₱{formatPrice(total)}</span>
            </div>
          </div>
        </main>

        <footer className="receipt-footer">
          <div className="footer-note">
            <p>A digital certificate of authenticity has been generated for your account.</p>
            <p>AUTHORIZED BY GOODSOLES.PH</p>
          </div>
          <div className="receipt-footer-actions">
            <button className="terminal-btn terminal-btn--secondary" onClick={() => navigate('/orderhistory')}>
              VIEW MY ORDERS
            </button>
            <button className="terminal-btn terminal-btn--primary" onClick={() => navigate('/')}>
              CONTINUE SHOPPING
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default Orders;
