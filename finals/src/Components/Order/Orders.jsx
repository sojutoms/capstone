import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import './Orders.css';
import { getOrderByNumber, verifyPaymentStatus } from '../../services/api';
import { getShippingTier } from '../../services/shippingFee';

const Orders = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const stateData = location.state || {};
  const redirectOrderNumber = searchParams.get('orderNumber');
  const paymentStatusParam = searchParams.get('paymentStatus');

  // PayMongo's hosted checkout redirects back via a plain URL (success_url),
  // so there's no React Router state to read — the order has to be fetched.
  const needsFetch = Boolean(redirectOrderNumber) && !stateData.purchasedItems;

  const [fetchedOrder, setFetchedOrder] = useState(null);
  const [loading, setLoading] = useState(needsFetch);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    if (!needsFetch) return;
    const token = localStorage.getItem('auth-token');
    if (!token) { setFetchError('Please log in to view this order.'); setLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        if (paymentStatusParam === 'success') {
          await verifyPaymentStatus(token, redirectOrderNumber);
        }
        const res = await getOrderByNumber(token, redirectOrderNumber);
        if (cancelled) return;
        if (res.success) setFetchedOrder(res.order);
        else setFetchError(res.error || 'Order not found.');
      } catch {
        if (!cancelled) setFetchError('Could not load your order.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsFetch, redirectOrderNumber, paymentStatusParam]);

  const formatPrice = (val) =>
    Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Normalize into one shape regardless of source (navigate-state vs fetched order) ──
  const orderNumber        = fetchedOrder?.orderNumber || stateData.orderNumber || 'N/A';
  const purchasedItems     = fetchedOrder?.items || stateData.purchasedItems || [];
  const discountAmount     = Number(fetchedOrder?.discountAmount ?? stateData.discountAmount ?? 0);
  const discountPercent    = Number(fetchedOrder?.discountPercent ?? stateData.discountPercent ?? 0);
  const voucherCode        = fetchedOrder?.voucherCode ?? stateData.voucherCode ?? null;
  const shippingFee        = Number(fetchedOrder?.shippingFee ?? stateData.shippingFee ?? 0);
  const codFee             = Number(fetchedOrder?.codFee ?? stateData.codFee ?? 0);
  const paymentMethod      = fetchedOrder?.paymentMethod || stateData.paymentMethod || '';
  const paymentStatus      = fetchedOrder?.paymentStatus || null;
  const shippingTierLabel  = fetchedOrder
    ? (getShippingTier(fetchedOrder.deliveryInfo?.region?.code)?.label || '')
    : (stateData.shippingTierLabel || '');

  const subtotal    = purchasedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount    = discountAmount;
  const shipping    = shippingFee;
  const cod         = codFee;
  const total       = subtotal + shipping + cod - discount;
  const isCod       = paymentMethod === 'cash on delivery';
  const isOnline    = paymentMethod === 'online';
  const isFreeShip  = shipping === 0;

  if (loading) {
    return (
      <div className="confirmation-terminal">
        <div className="receipt-wrapper">
          <p className="empty-msg">Loading your order…</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="confirmation-terminal">
        <div className="receipt-wrapper">
          <p className="empty-msg">{fetchError}</p>
          <div className="receipt-footer-actions">
            <button className="terminal-btn terminal-btn--primary" onClick={() => navigate('/orderhistory')}>
              VIEW MY ORDERS
            </button>
          </div>
        </div>
      </div>
    );
  }

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

        {isOnline && paymentStatus === 'paid' && (
          <div className="gcash-paid-badge">
            <span className="gcash-paid-icon">✓</span>
            <div className="gcash-paid-text">
              <strong>Payment Confirmed</strong>
              <span>Paid via PayMongo</span>
            </div>
            <span className="gcash-paid-check">✓</span>
          </div>
        )}

        {isOnline && paymentStatus && paymentStatus !== 'paid' && (
          <div className="gcash-paid-badge" style={{ background: 'rgba(255, 176, 32, 0.12)', borderColor: 'rgba(255, 176, 32, 0.35)' }}>
            <div className="gcash-paid-text">
              <strong>Confirming Payment…</strong>
              <span>This can take a minute — refresh the page to check again.</span>
            </div>
          </div>
        )}

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
