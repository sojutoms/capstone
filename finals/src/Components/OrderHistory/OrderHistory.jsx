import React, { useCallback, useEffect, useRef, useState } from "react";
import "./OrderHistory.css";
import ReviewModal from "../ProductDisplay/ReviewModal";
import RefundModal from "../ProductDisplay/RefundModal";
import API_BASE_URL from "../../services/api";

const DELIVERED_AUTO_COMPLETE_DAYS = 3;
const REFUND_WINDOW_DAYS = 1; 

const cancellableStatuses = ["pending"];

const normalizeStatus = (s) =>
  String(s || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-+/g, "_");

const prettyStatus = (s) =>
  String(s || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatPrice = (val) =>
  Number(val || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const daysElapsed = (isoTimestamp, days) => {
  if (!isoTimestamp) return false;
  const ms = days * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(isoTimestamp).getTime() >= ms;
};

// const timeUntilAutoComplete = (deliveredAt) => {
//   if (!deliveredAt) return null;
//   const deadline =
//     new Date(deliveredAt).getTime() +
//     DELIVERED_AUTO_COMPLETE_DAYS * 24 * 60 * 60 * 1000;
//   const diffMs = deadline - Date.now();
//   if (diffMs <= 0) return null;
//   const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
//   if (diffHrs < 24) return `${diffHrs}h`;
//   return `${Math.ceil(diffHrs / 24)}d`;
// };

const STATUS_DISPLAY_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  shipping: "Shipping",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  refund_requested: "Refund Requested",
  refund_approved: "Refund Approved",
  refund_rejected: "Refund Rejected",
  refunded: "Refunded",
};

// const RiderCard = ({ rider }) => {
//   if (!rider || !rider.name) return null;
//   return (
//     <div className="rider-card">
//       <span className="rider-card__title">YOUR RIDER IS EN ROUTE</span>
//       <div className="rider-card__body">
//         <div className="rider-card__field">
//           <span className="rider-card__label">NAME:</span>
//           <span className="rider-card__value">{rider.name}</span>
//         </div>
//         <div className="rider-card__field">
//           <span className="rider-card__label">PLATE:</span>
//           <span className="rider-card__value">{rider.plate}</span>
//         </div>
//         <div className="rider-card__field">
//           <span className="rider-card__label">PHONE:</span>
//           <a className="rider-card__phone" href={`tel:${rider.phone}`}>{rider.phone}</a>
//         </div>
//       </div>
//     </div>
//   );
// };

const DigitalCertificate = ({ order, onClose }) => {
  if (!order) return null;
  const serialNumber = `GS-${order.orderNumber.toString().padStart(6, '0')}-${order.timestamp.toString().slice(-4)}`;

  return (
    <div className="certificate-modal">
      <div className="certificate-backdrop" onClick={onClose} />
      <div className="certificate-paper">
        <div className="certificate-border">
          <div className="certificate-header">
            <div className="gs-seal">GOODSOLES.PH</div>
            <h3>CERTIFICATE OF AUTHENTICITY</h3>
            <p className="cert-subtitle">PREMIUM COLLECTOR SERIES</p>
          </div>
          <div className="certificate-body">
            <div className="cert-row">
              <span className="cert-label">ITEM IDENTIFIER</span>
              <span className="cert-value">{order.items[0]?.name || "Premium Selection"}</span>
            </div>
            <div className="cert-row">
              <span className="cert-label">ACQUISITION DATE</span>
              <span className="cert-value">{new Date(order.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="cert-row">
              <span className="cert-label">VERIFICATION ID</span>
              <span className="cert-value">{serialNumber}</span>
            </div>
            <div className="cert-statement">
              This digital certificate verifies that the aforementioned item has undergone a rigorous multi-point inspection by GoodSoles experts and is guaranteed 100% authentic.
            </div>
          </div>
          <div className="certificate-footer">
            <div className="cert-signature">
               <span className="sig-line"></span>
               <span className="sig-label">AUTHORIZED SIGNATURE</span>
            </div>
            <div className="cert-hologram">
               <div className="hologram-circle"><span>AUTHENTIC</span></div>
            </div>
          </div>
          <div className="cert-actions">
            <button className="cert-btn cert-btn--primary" onClick={() => window.print()}>DOWNLOAD DIGITAL COPY</button>
            <button className="cert-btn" onClick={onClose}>CLOSE DOCUMENT</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ordersPerPage = 10;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewProduct, setReviewProduct] = useState(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundOrder, setRefundOrder] = useState(null);
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [certOrder, setCertOrder] = useState(null); 
  const [confirmModal, setConfirmModal] = useState({ open: false, order: null });
  const [receivedModal, setReceivedModal] = useState({ open: false, order: null });

  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    if (toastTimersRef.current[id]) {
      clearTimeout(toastTimersRef.current[id]);
      delete toastTimersRef.current[id];
    }
  }, []);

  const addToast = useCallback((type, message, duration = 4000) => {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, type, message }]);
    if (duration > 0) {
      const timer = setTimeout(() => removeToast(id), duration);
      toastTimersRef.current[id] = timer;
    }
  }, [removeToast]);

  const fetchOrders = useCallback(async (page = 1, status = "all") => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/orderhistory?page=${page}&limit=${ordersPerPage}&status=${status}&t=${Date.now()}`,
        { headers: { "auth-token": localStorage.getItem("auth-token") } }
      );
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders || []);
        setCurrentPage(data.page || page);
        setTotalPages(data.totalPages || 1);
      } else {
        addToast("error", data.error || "Failed to load orders.");
      }
    } catch (err) {
      addToast("error", "Failed to load orders.");
    }
  }, [addToast]);

  useEffect(() => {
    fetchOrders(currentPage, statusFilter);
  }, [currentPage, statusFilter, fetchOrders]);

  const effectiveStatus = (order) => {
    if (order.displayStatus) {
      const ds = normalizeStatus(order.displayStatus);
      if (ds === "delivered") {
        const deliveredAt = order.deliveredAt || order.updatedAt;
        if (daysElapsed(deliveredAt, DELIVERED_AUTO_COMPLETE_DAYS)) return "completed";
        return "shipping";
      }
      return ds;
    }
    const raw = normalizeStatus(order.status);
    if (raw === "delivered") {
      const deliveredAt = order.deliveredAt || order.updatedAt;
      if (daysElapsed(deliveredAt, DELIVERED_AUTO_COMPLETE_DAYS)) return "completed";
      return "shipping";
    }
    return raw;
  };

  const rawStatus = (order) => normalizeStatus(order.status);

  const canRequestRefund = (order) => {
    const eff = effectiveStatus(order);
    if (eff !== "completed") return false;
    if (order.refundStatus || order.refundReason) return false;
    const completedAt = order.completedAt || order.updatedAt;
    return !daysElapsed(completedAt, REFUND_WINDOW_DAYS);
  };

  const confirmOrderReceived = async (order) => {
    try {
      const res = await fetch(`${API_BASE_URL}/order/${order.orderNumber}/confirm-received`, {
        method: "POST",
        headers: {
          "auth-token": localStorage.getItem("auth-token"),
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (data && data.success) {
        addToast("success", "Order marked as received. Thank you!");
        fetchOrders(currentPage);
      } else {
        addToast("error", data?.error || "Failed to confirm receipt.");
      }
    } catch (err) {
      addToast("error", "Failed to confirm receipt.");
    } finally {
      // Done
    }
  };

  const printReceipt = (order) => {
    const eff = effectiveStatus(order);
    if (eff !== "completed") return;
    const subtotal = order.subtotal || order.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const shippingFee = Number(order.shippingFee) || 0;
    const total = order.total || 0;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    const receiptContent = `
      <html><head><title>Receipt - Order #${order.orderNumber}</title>
      <style>
        body { font-family: 'Outfit', sans-serif; padding: 40px; color: #000; background: #fff; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border-bottom: 1px solid #eee; padding: 12px; text-align: left; }
        .summary-row { font-weight: 500; color: #444; }
        .total-row { font-weight: bold; font-size: 1.2em; border-top: 2px solid #000; }
        .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
        .footer { margin-top: 40px; font-size: 0.9em; color: #888; text-align: center; }
      </style>
      </head><body>
      <div class="header">
        <h1>GOODSOLES.PH</h1>
        <p>Order Receipt #${order.orderNumber}</p>
        <p>Date: ${new Date(order.timestamp).toLocaleString()}</p>
      </div>
      <table>
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Price</th></tr>
        </thead>
        <tbody>
          ${order.items.map(it => `<tr><td>${it.name}</td><td>${it.quantity}</td><td>₱${it.price.toLocaleString()}</td></tr>`).join('')}
          <tr class="summary-row"><td colspan="2">SUBTOTAL</td><td>₱${subtotal.toLocaleString()}</td></tr>
          <tr class="summary-row"><td colspan="2">SHIPPING FEE</td><td>₱${shippingFee.toLocaleString()}</td></tr>
          <tr class="total-row"><td colspan="2">TOTAL PAID</td><td>₱${total.toLocaleString()}</td></tr>
        </tbody>
      </table>
      <div class="footer">
        <p>Thank you for choosing GoodSoles PH. Your curation is our priority.</p>
        <p>This is a digitally generated receipt.</p>
      </div>
      </body></html>`;
    printWindow.document.write(receiptContent);
    printWindow.document.close();
    printWindow.print();
  };

  const renderStatusPill = (order) => {
    const eff = effectiveStatus(order);
    return <span className={`status-pill status-pill--${eff}`}>{STATUS_DISPLAY_LABELS[eff] || prettyStatus(eff)}</span>;
  };

  const renderTimeline = (order) => {
    const eff = effectiveStatus(order);
    if (eff === "cancelled") return <div className="timeline-cancelled">ORDER CANCELLED</div>;

    const luxurySteps = [
      { key: "pending", label: "ORDERED" },
      { key: "confirmed", label: "AUTHENTICATED" },
      { key: "shipping", label: "CURATION" },
      { key: "delivered", label: "COMPLETED" }
    ];

    const deliveryEff = eff === "completed" ? "delivered" : eff;
    const activeIdx = luxurySteps.findIndex(s => s.key === deliveryEff);

    return (
      <div className="order-timeline">
        {luxurySteps.map((step, i) => (
          <div key={step.key} className={`timeline-step ${i <= activeIdx ? "active" : ""}`}>
            <div className="timeline-dot" />
            <span className="timeline-label">{step.label}</span>
          </div>
        ))}
      </div>
    );
  };

  const closeReview = () => { setReviewOpen(false); setReviewProduct(null); };
  const closeRefundModal = () => { setRefundOpen(false); setRefundOrder(null); setRefundSubmitting(false); };

  const submitRefund = async (reason, notes, files = []) => {
    if (!refundOrder) return;
    setRefundSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("reason", reason);
      if (notes) formData.append("notes", notes);
      files.forEach(f => formData.append("media", f));

      const res = await fetch(`${API_BASE_URL}/order/${refundOrder.orderNumber}/refund`, {
        method: "POST",
        headers: { "auth-token": localStorage.getItem("auth-token") },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders(currentPage);
        closeRefundModal();
        addToast("success", "Refund request submitted.");
      } else {
        addToast("error", data.error || "Request failed");
      }
    } catch (err) {
      addToast("error", "Failed to submit request.");
    } finally {
      setRefundSubmitting(false);
    }
  };

  const cancelOrder = async (order) => {
    try {
      const res = await fetch(`${API_BASE_URL}/order/${order.orderNumber}/cancel`, {
        method: "POST",
        headers: { "auth-token": localStorage.getItem("auth-token"), "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        addToast("success", "Order cancelled.");
        fetchOrders(currentPage);
      }
    } finally {
      // Done
    }
  };

  const renderConfirmReceivedBanner = (order) => {
    if (rawStatus(order) !== "delivered") return null;
    return (
      <div className="confirm-received-banner">
        <span>Order Delivered — Please confirm receipt to complete.</span>
        <button className="btn-confirm-received" onClick={() => setReceivedModal({ open: true, order })}>CONFIRM</button>
      </div>
    );
  };

  return (
    <div className="order-history-container">
      <div className="order-history-filters">
        {["all", "pending", "confirmed", "shipping", "delivered"].map(f => (
          <button key={f} className={`order-filter-btn ${statusFilter === f ? "active" : ""}`} onClick={() => { setStatusFilter(f); setCurrentPage(1); setSelected(null); }}>
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="order-history-split-layout">
        <aside className="orders-sidebar">
          <div className="orders-list-compact">
            {orders.map(o => (
              <div key={o._id} className={`order-item-compact ${selected?._id === o._id ? 'selected' : ''}`} onClick={() => setSelected(o)}>
                <div className="compact-header">
                  <span className="compact-id">#{o.orderNumber.slice(-8)}</span>
                  {renderStatusPill(o)}
                </div>
                <div className="compact-meta">
                  <span>{new Date(o.timestamp).toLocaleDateString()}</span>
                  <span>₱{formatPrice(o.total)}</span>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="compact-pagination">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>PREV</button>
              <span>{currentPage} / {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>NEXT</button>
            </div>
          )}
        </aside>

        <main className="order-details-pane">
          {selected ? (
            <div className="details-scroll-content content-fade-in">
              <div className="details-header-innovative">
                <div className="header-top">
                  <div>
                    <h2 className="details-title">ORDER DETAILS</h2>
                    <p className="details-id">#{selected.orderNumber}</p>
                    <p className="details-date">Placed on {new Date(selected.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="details-actions-top">
                    {effectiveStatus(selected) === "completed" && <button className="details-util-btn" onClick={() => setCertOrder(selected)}>🛡 CERTIFICATE</button>}
                    {effectiveStatus(selected) === "completed" && <button className="details-util-btn" onClick={() => printReceipt(selected)}>📄 RECEIPT</button>}
                  </div>
                </div>
                {renderTimeline(selected)}
              </div>

              {renderConfirmReceivedBanner(selected)}

              <div className="details-section">
                <h3>[ MANIFEST ]</h3>
                <div className="manifest-items-list">
                  {selected.items.map((item, idx) => (
                    <div key={idx} className="manifest-item-row">
                      <img src={item.image} alt={item.name} className="manifest-img" />
                      <div className="manifest-info">
                        <div className="manifest-info-top">
                          <p className="manifest-name">{item.name}</p>
                          <span className="manifest-item-price">₱{formatPrice(item.price * item.quantity)}</span>
                        </div>
                        <p className="manifest-sub">SIZE: {item.size || 'N/A'} • QTY: {item.quantity}</p>
                        {effectiveStatus(selected) === "completed" && (
                          <button className="manifest-review-btn" onClick={() => { setReviewProduct(item); setReviewOpen(true); }}>WRITE REVIEW</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="details-footer-summary">
                <div className="summary-grid">
                  <div className="summary-col">
                    <h4>DELIVERY</h4>
                    <p>{selected.deliveryInfo.firstName} {selected.deliveryInfo.lastName}</p>
                    <p>{selected.deliveryInfo.street}, {selected.deliveryInfo.barangay?.name}</p>
                    <p>{selected.deliveryInfo.cityOrMunicipality?.name}, {selected.deliveryInfo.province?.name}</p>
                  </div>
                  <div className="summary-col totals-col">
                    <div className="summary-row"><span>Subtotal</span><span>₱{formatPrice(selected.subtotal || selected.items.reduce((s,i)=>s+i.price*i.quantity,0))}</span></div>
                    <div className="summary-row"><span>Shipping</span><span>{selected.shippingFee === 0 ? 'FREE' : `₱${formatPrice(selected.shippingFee)}`}</span></div>
                    {selected.discountAmount > 0 && <div className="summary-row discount"><span>Discount</span><span>-₱{formatPrice(selected.discountAmount)}</span></div>}
                    <div className="summary-row total"><span>TOTAL</span><span>₱{formatPrice(selected.total)}</span></div>
                  </div>
                </div>
                <div className="details-final-actions">
                  {cancellableStatuses.includes(normalizeStatus(selected.status)) && <button className="pane-btn btn-danger" onClick={() => setConfirmModal({ open: true, order: selected })}>CANCEL ORDER</button>}
                  {canRequestRefund(selected) && <button className="pane-btn btn-refund" onClick={() => setRefundOpen(true)}>REQUEST REFUND</button>}
                </div>
              </div>
            </div>
          ) : (
            <div className="details-empty-state"><h3>SELECT AN ORDER</h3><p>Pick an entry to view details.</p></div>
          )}
        </main>
      </div>

      {reviewOpen && <ReviewModal open={reviewOpen} onClose={closeReview} product={reviewProduct} orderId={selected?._id} />}
      {refundOpen && <RefundModal open={refundOpen} onClose={closeRefundModal} onSubmit={submitRefund} loading={refundSubmitting} order={selected} />}
      {certOrder && <DigitalCertificate order={certOrder} onClose={() => setCertOrder(null)} />}
      
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.message}</span>
            <button onClick={() => removeToast(t.id)}>×</button>
          </div>
        ))}
      </div>

      {confirmModal.open && (
        <div className="confirm-modal">
          <div className="confirm-modal-backdrop" onClick={() => setConfirmModal({ open: false, order: null })} />
          <div className="confirm-modal-box">
            <h4>Cancel Order?</h4>
            <div className="confirm-modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmModal({ open: false, order: null })}>NO</button>
              <button className="btn btn-danger" onClick={() => { cancelOrder(confirmModal.order); setConfirmModal({ open: false, order: null }); }}>YES</button>
            </div>
          </div>
        </div>
      )}
      {receivedModal.open && (
        <div className="confirm-modal">
          <div className="confirm-modal-backdrop" onClick={() => setReceivedModal({ open: false, order: null })} />
          <div className="confirm-modal-box">
            <h4>Confirm Received?</h4>
            <div className="confirm-modal-actions">
              <button className="btn btn-secondary" onClick={() => setReceivedModal({ open: false, order: null })}>NO</button>
              <button className="btn btn-confirm-received" onClick={() => { confirmOrderReceived(receivedModal.order); setReceivedModal({ open: false, order: null }); }}>YES</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
