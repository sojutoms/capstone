import React, { useEffect, useState, useRef, useCallback } from "react";
import "./Transaction.css";
import API_BASE_URL, { authorizedFetch } from "../../services/api";
import RiderModal from "../RiderModal/RiderModal";

const STATUS_OPTIONS = [
  "all", "pending", "confirmed", "shipping", "delivered",
  "completed", "cancelled", "refund_requested", "refunded",
];

const ADMIN_STATUS_API_MAP = {
  pending: "pending", confirmed: "confirmed", shipping: "shipping",
  delivered: "delivered", completed: "completed", cancelled: "cancelled",
  refund_requested: "refund_requested", refunded: "refunded",
};

const ADMIN_STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  shipping: "Shipping",
  delivered: "Delivered (awaiting customer confirmation)",
  completed: "Completed (force — bypasses customer confirmation)",
  cancelled: "Cancelled",
  refund_requested: "Refund Requested",
  refunded: "Refunded",
};

// ─── Shared auth header helper ─────────────────────────────────────────────────
const getAuthHeaders = () => {
  const token =
    sessionStorage.getItem("admin-token") ||
    localStorage.getItem("admin-token") ||
    sessionStorage.getItem("auth-token") ||
    localStorage.getItem("auth-token") ||
    "";
  return token ? { "auth-token": token } : {};
};

// ─── Toast hook ────────────────────────────────────────────────────────────────
const useToasts = () => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timers = useRef({});

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id]; }
  }, []);

  const add = useCallback(({ message, type = "info", duration = 4500, actions = [] }) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type, actions }]);
    if (duration > 0) timers.current[id] = setTimeout(() => remove(id), duration);
    return id;
  }, [remove]);

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  return { toasts, add, remove };
};

const Toasts = ({ toasts, remove }) => (
  <div className="toast-root" aria-live="polite">
    {toasts.map((t) => (
      <div key={t.id} className={`toast toast-${t.type} glass-strong animate-in`}>
        <div className="toast-body">
          <div className="toast-message" style={{ fontWeight: 600 }}>{t.message}</div>
          {t.actions?.length > 0 && (
            <div className="toast-actions" style={{ marginTop: 12 }}>
              {t.actions.map((a, i) => (
                <button key={i} className={`toast-action ${a.variant || ""}`}
                  style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}
                  onClick={() => { try { a.onClick?.(); } catch { } finally { remove(t.id); } }}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="toast-close" onClick={() => remove(t.id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    ))}
  </div>
);

// ─── Confirmation modal ────────────────────────────────────────────────────────
const ConfirmModal = ({ open, title, message, onConfirm, onCancel, confirmLabel = "Confirm", confirmClass = "danger" }) => {
  if (!open) return null;
  return (
    <div className="confirm-modal-backdrop" onClick={onCancel} style={{ zIndex: 10001, backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.8)' }}>
      <div className="confirm-modal glass-strong animate-in" onClick={(e) => e.stopPropagation()} style={{ padding: '40px', maxWidth: '450px', border: '1px solid var(--border-subtle)' }}>
        {title && <h3 className="confirm-modal-title chrome-text" style={{ fontSize: '24px', marginBottom: 16 }}>{title}</h3>}
        <p className="confirm-modal-message" style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 14 }}>{message}</p>
        <div className="confirm-modal-actions" style={{ marginTop: 32, gap: 12 }}>
          <button className="confirm-modal-btn secondary" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border-subtle)' }} onClick={onCancel}>BACK</button>
          <button className={`confirm-modal-btn ${confirmClass}`} style={{ flex: 2, height: '48px', fontWeight: 800 }} onClick={onConfirm}>{confirmLabel.toUpperCase()}</button>
        </div>
      </div>
    </div>
  );
};

// ─── ProcessedBy badge ────────────────────────────────────────────────────────
const ProcessedByBadge = ({ processedBy }) => {
  if (!processedBy || !processedBy.email) return null;
  return (
    <div className="role-badge role-badge--admin animate-in" style={{ padding: '6px 12px', fontSize: 11, letterSpacing: '0.05em' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: 6 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      {processedBy.name ? `${processedBy.name.toUpperCase()} / ` : ""}
      <span style={{ opacity: 0.8 }}>{processedBy.email.toUpperCase()}</span>
    </div>
  );
};

// ─── Rider info card ───────────────────────────────────────────────────────────
const RiderInfoCard = ({ rider }) => {
  if (!rider || !rider.name) return null;
  return (
    <div className="glass-medium animate-in" style={{
      marginTop: 12, padding: "20px",
      border: "1px solid var(--border-subtle)", borderRadius: 16,
      background: 'rgba(96, 165, 250, 0.05)'
    }}>
      <div style={{ fontSize: 10, fontWeight: 900, color: "#60a5fa", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.15em", display: 'flex', alignItems: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: 8 }}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        RIDER DISPATCHED
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {[
          { label: "NAME", value: rider.name },
          { label: "PLATE", value: rider.plate },
          { label: "MOBILE", value: rider.phone },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 800, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 13, color: "var(--text-main)", fontWeight: 700 }}>{value || "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Full delivery address ────────────────────────────────────────────────────
const buildFullAddress = (info) => {
  if (!info) return "—";
  const parts = [info.street, info.barangay?.name, info.cityOrMunicipality?.name, info.province?.name, info.region?.name].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
};

// ─── Refund status badge ──────────────────────────────────────────────────────
const RefundStatusBadge = ({ status }) => {
  return (
    <span className={`transaction-status transaction-status--${status === 'approved' ? 'confirmed' : status === 'rejected' ? 'cancelled' : status === 'refunded' ? 'completed' : 'pending'}`}>
      {status === 'refund_requested' ? 'REQUESTED' : status.toUpperCase()}
    </span>
  );
};

// ─── Luxe Select Component ───────────────────────────────────────────────────
const LuxeSelect = ({ value, options, onChange, placeholder = "Select option" }) => {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggle = () => {
    if (!open && rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUp(spaceBelow < 300);
    }
    setOpen(!open);
  };

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className={`luxe-select-root ${open ? 'open' : ''} ${openUp ? 'up' : ''}`} ref={rootRef}>
      <div className="luxe-select-trigger" onClick={toggle}>
        {selectedOption ? selectedOption.label.toUpperCase() : placeholder.toUpperCase()}
      </div>
      {open && (
        <div className="luxe-select-dropdown">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`luxe-select-option ${value === opt.value ? 'selected' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label.toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Media lightbox ───────────────────────────────────────────────────────────
const MediaLightbox = ({ items, startIdx, onClose }) => {
  const [idx, setIdx] = useState(startIdx);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, items.length - 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, onClose]);

  const item = items[idx];
  if (!item) return null;
  const isVideo = item.type === "video" || /\.(mp4|mov|webm|ogg)$/i.test(item.url || "");

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div className="lightbox-box" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>✕</button>
        {isVideo
          ? <video src={item.url} controls autoPlay className="lightbox-media" />
          : <img src={item.url} alt={`Attachment ${idx + 1}`} className="lightbox-media" />}
        {items.length > 1 && (
          <div className="lightbox-nav">
            <button onClick={() => setIdx((i) => Math.max(i - 1, 0))} disabled={idx === 0}>‹</button>
            <span>{idx + 1} / {items.length}</span>
            <button onClick={() => setIdx((i) => Math.min(i + 1, items.length - 1))} disabled={idx === items.length - 1}>›</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── helper: is a media item a video? ────────────────────────────────────────
const isMediaVideo = (m) =>
  m.type === "video" || /\.(mp4|mov|webm|ogg)$/i.test(m.url || "");

// ─── Refund row thumbnail strip ───────────────────────────────────────────────
const RefundRowThumbs = ({ media, onThumbClick }) => {
  if (!media || media.length === 0) return null;
  const visible = media.slice(0, 4);
  const overflow = media.length - 4;
  return (
    <div className="refund-row-thumbs">
      {visible.map((m, i) => {
        const isVid = isMediaVideo(m);
        return (
          <div
            key={i}
            className="refund-row-thumb"
            onClick={(e) => { e.stopPropagation(); onThumbClick && onThumbClick(i); }}
            title={isVid ? "Video attachment" : "Image attachment"}
          >
            {isVid
              ? <video src={m.url} className="refund-row-thumb-media" muted playsInline />
              : <img src={m.url} alt="" className="refund-row-thumb-media" />}
            {isVid && (
              <span className="refund-row-thumb-play" aria-hidden="true">▶</span>
            )}
          </div>
        );
      })}
      {overflow > 0 && (
        <div className="refund-row-thumb refund-row-thumb--more">
          +{overflow}
        </div>
      )}
    </div>
  );
};

// ─── Refunds Tab ──────────────────────────────────────────────────────────────
const RefundsTab = ({ addToast, onSelectRefund, selectedRefundId, setAdminNote }) => {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [lightbox, setLightbox] = useState(null);
  const LIMIT = 12;

  const fetchRefunds = useCallback(async (p = 1, sf = "all", q = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", p);
      params.set("limit", LIMIT);
      if (sf && sf !== "all") params.set("status", sf);
      if (q.trim()) params.set("q", q.trim());

      const res = await authorizedFetch(`/admin/refunds?${params}`);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error || `Server error ${res.status}`;
        if (res.status === 401 || res.status === 403) {
          addToast({ message: `Auth error (${res.status}): ${msg} — check your admin token.`, type: "error", duration: 8000 });
        } else {
          addToast({ message: `Failed to load refunds: ${msg}`, type: "error" });
        }
        setRefunds([]); setTotal(0);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setRefunds(data.refunds || []);
        setTotal(data.total || 0);
      } else {
        setRefunds([]); setTotal(0);
        addToast({ message: data.error || "Failed to load refunds", type: "error" });
      }
    } catch (err) {
      console.error("fetchRefunds error:", err);
      setRefunds([]); setTotal(0);
      addToast({ message: `Network error: ${err.message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchRefunds(page, statusFilter, query); }, [page, statusFilter, query, fetchRefunds]);

  const openRefund = async (refundId) => {
    try {
      const res = await authorizedFetch(`/admin/refund/${refundId}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        addToast({ message: `Could not load refund (${res.status}): ${errData.error || ""}`, type: "error" });
        return;
      }
      const data = await res.json();
      if (data.success) {
        onSelectRefund(data.refund);
        setAdminNote(data.refund.adminNote || "");
      } else {
        addToast({ message: data.error || "Could not load refund details", type: "error" });
      }
    } catch (err) {
      addToast({ message: `Network error: ${err.message}`, type: "error" });
    }
  };

  const handleAction = async (refundId, action) => {
    setActionLoading(true);
    try {
      const res = await authorizedFetch(`/admin/refund/${refundId}/status`, {
        method: "POST",
        body: JSON.stringify({ status: action, adminNote }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        addToast({ message: `Action failed (${res.status}): ${errData.error || ""}`, type: "error" });
        return;
      }
      const data = await res.json();
      if (data.success) {
        addToast({
          message: `Refund ${action === "approved" ? "approved" : action === "rejected" ? "rejected" : "marked as refunded"}.`,
          type: action === "rejected" ? "warning" : "success",
        });
        setSelectedRefund(null);
        fetchRefunds(page, statusFilter, query);
      } else {
        addToast({ message: data.error || "Action failed", type: "error" });
      }
    } catch (err) {
      addToast({ message: `Network error: ${err.message}`, type: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const STATUS_FILTERS = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "refunded", label: "Refunded" },
  ];

  return (
    <div className="refunds-tab animate-in">
      {lightbox && (
        <MediaLightbox
          items={lightbox.items}
          startIdx={lightbox.startIdx}
          onClose={() => setLightbox(null)}
        />
      )}

      <div className="sku-controls glass animate-in">
        <div className="search-wrapper-luxe">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="Search by order #, name or email..." value={query} onChange={(e) => setQuery(e.target.value)} className="search-input-luxe" />
        </div>
        <div className="filter-group">
          <LuxeSelect
            value={statusFilter}
            options={STATUS_FILTERS}
            onChange={(val) => { setStatusFilter(val); setPage(1); }}
          />
        </div>
        <div className="results-badge">{total} REQUESTS FOUND</div>
      </div>

      {loading && <div className="no-results glass-medium full-width">LOADING REFUND REQUESTS...</div>}
      
      <div className="user-grid">
        {!loading && refunds.length === 0 && (
          <div className="no-results glass-medium full-width">NO REFUND REQUESTS MATCHING FILTERS</div>
        )}
        {!loading && refunds.map((r) => (
          <div key={r._id || r.id} className={`transaction-summary animate-in glass-medium ${selectedRefundId === (r._id || r.id) ? "active" : ""}`} onClick={() => openRefund(r._id || r.id)}>
            <div className="transaction-summary-left">
              <div className="transaction-number">#{r.orderNumber}</div>
              <div className="transaction-buyer">{r.buyer?.name || "—"}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 4 }}>{r.reason}</div>
            </div>
            <div className="transaction-summary-right">
              <RefundStatusBadge status={r.status} />
              <div className="refund-row-date" style={{ marginTop: 8 }}>
                {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }).toUpperCase() : "—"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="sku-pagination animate-in" style={{ marginTop: 40 }}>
          <button className="page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>PREV</button>
          <div className="page-info">Page <strong>{page}</strong> of <strong>{totalPages}</strong></div>
          <button className="page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>NEXT</button>
        </div>
      )}
    </div>
  );
};

// ─── Main Transactions Component ──────────────────────────────────────────────
const Transactions = () => {
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [total, setTotal] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useRef(null);

  const [confirmModal, setConfirmModal] = useState({ open: false, orderNumber: null, newStatus: null });
  const [riderModal, setRiderModal] = useState({ open: false, orderNumber: null });
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const { toasts, add: addToast, remove: removeToast } = useToasts();

  const fetchOrders = useCallback(async (p, s, q) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", p);
      params.set("limit", limit);
      if (s && s !== "all") params.set("status", s);
      if (q && q.trim().length) params.set("q", q.trim());

      const res = await authorizedFetch(`/admin/orders?${params.toString()}`);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error || `Server error ${res.status}`;
        if (res.status === 401 || res.status === 403) {
          addToast({ message: `Auth error (${res.status}): ${msg}`, type: "error", duration: 8000 });
        } else {
          addToast({ message: `Failed to load orders: ${msg}`, type: "error" });
        }
        setOrders([]); setTotal(0);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []); setTotal(data.total || 0); setPage(data.page || p);
      } else {
        setOrders([]); setTotal(0);
        addToast({ message: data.error || "Failed to load orders", type: "error" });
      }
    } catch (err) {
      console.error("fetchOrders error:", err);
      setOrders([]); setTotal(0);
      addToast({ message: `Network error: ${err.message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [limit, addToast]);

  useEffect(() => {
    if (debounced.current) clearTimeout(debounced.current);
    debounced.current = setTimeout(() => { fetchOrders(1, statusFilter, query); setPage(1); }, 400);
    return () => clearTimeout(debounced.current);
  }, [query, statusFilter, fetchOrders]);

  useEffect(() => { fetchOrders(page, statusFilter, query); }, [page, statusFilter, query, fetchOrders]);

  const openOrder = useCallback(async (orderNumber) => {
    try {
      const res = await authorizedFetch(`/admin/order/${orderNumber}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        addToast({ message: `Could not load order (${res.status}): ${errData.error || ""}`, type: "error" });
        setSelectedOrder(null);
        return;
      }
      const data = await res.json();
      if (data.success) setSelectedOrder(data.order);
      else { setSelectedOrder(null); addToast({ message: "Could not load order details", type: "error" }); }
    } catch (err) {
      setSelectedOrder(null);
      addToast({ message: `Network error: ${err.message}`, type: "error" });
    }
  }, [addToast]);

  const handleStatusChange = (orderNumber, newStatus) => {
    if (newStatus === "cancelled") {
      setConfirmModal({ open: true, orderNumber, newStatus });
    } else if (newStatus === "shipping") {
      setRiderModal({ open: true, orderNumber });
    } else {
      doUpdateStatus(orderNumber, newStatus);
    }
  };

  const handleRiderConfirm = async (riderDetails) => {
    const { orderNumber } = riderModal;
    setRiderModal({ open: false, orderNumber: null });
    await doUpdateStatus(orderNumber, "shipping", riderDetails);
  };

  const handleRiderCancel = () => {
    const { orderNumber } = riderModal;
    setRiderModal({ open: false, orderNumber: null });
    if (orderNumber) openOrder(orderNumber);
  };

  const doUpdateStatus = async (orderNumber, newStatus, riderDetails = null) => {
    const apiStatus = ADMIN_STATUS_API_MAP[newStatus] || newStatus;
    try {
      const body = { status: apiStatus };
      if (riderDetails) body.rider = riderDetails;
      const res = await authorizedFetch(`/admin/order/${orderNumber}/status`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        const label = apiStatus === "cancelled"
          ? "cancelled — SKUs and stock have been restored"
          : apiStatus === "delivered"
            ? "marked as Delivered — customer will be prompted to confirm receipt"
            : apiStatus === "shipping"
              ? "marked as Shipping — rider details saved and customer notified"
              : `updated to "${apiStatus}"`;
        addToast({ message: `Order status ${label}`, type: apiStatus === "cancelled" ? "warning" : "success" });
        fetchOrders(page, statusFilter, query);
        openOrder(orderNumber);
      } else {
        addToast({ message: data.error || "Failed to update status", type: "error" });
      }
    } catch (err) {
      addToast({ message: `Network error: ${err.message}`, type: "error" });
    }
  };

  const confirmCancel = () => {
    const { orderNumber, newStatus } = confirmModal;
    setConfirmModal({ open: false, orderNumber: null, newStatus: null });
    doUpdateStatus(orderNumber, newStatus);
  };

  const dismissConfirm = () => {
    const { orderNumber } = confirmModal;
    setConfirmModal({ open: false, orderNumber: null, newStatus: null });
    if (orderNumber) openOrder(orderNumber);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleRefundAction = async (refundId, action) => {
    setActionLoading(true);
    try {
      const res = await authorizedFetch(`/admin/refund/${refundId}/status`, {
        method: "POST",
        body: JSON.stringify({ status: action, adminNote }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        addToast({ message: `Action failed: ${errData.error || ""}`, type: "error" });
        return;
      }
      const data = await res.json();
      if (data.success) {
        addToast({ message: `Refund ${action}.`, type: action === "rejected" ? "warning" : "success" });
        setSelectedRefund(null);
        // The list will refresh via useEffect in RefundsTab if we pass a toggle or just depend on selectedRefund changing to null
      }
    } catch (err) {
      addToast({ message: `Error: ${err.message}`, type: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedOrder(null);
    setSelectedRefund(null);
  };

  return (
    <div className="transactions animate-in">
      <Toasts toasts={toasts} remove={removeToast} />

      <ConfirmModal
        open={confirmModal.open}
        title="Cancel Order?"
        message={`Cancel order #${confirmModal.orderNumber}? This will restore all SKUs and product stock.`}
        confirmLabel="Yes, Cancel Order"
        confirmClass="danger"
        onConfirm={confirmCancel}
        onCancel={dismissConfirm}
      />

      <RiderModal
        open={riderModal.open}
        orderNumber={riderModal.orderNumber}
        onConfirm={handleRiderConfirm}
        onCancel={handleRiderCancel}
      />

      <div className="panel-header">
        <h1 className="chrome-text">TRANSACTIONS</h1>
        <div className="role-context-banner">Managing customer orders and refund requests.</div>
      </div>

      <div className="tab-navigation glass-strong">
        <button className={`tab-btn ${activeTab === "orders" ? "active" : ""}`} onClick={() => { setActiveTab("orders"); setSelectedOrder(null); setSelectedRefund(null); }}>Orders</button>
        <button className={`tab-btn ${activeTab === "refunds" ? "active" : ""}`} onClick={() => { setActiveTab("refunds"); setSelectedOrder(null); setSelectedRefund(null); }}>Refund Requests</button>
      </div>

      <div className="transactions-content-split">
        <div className="transactions-left">
          {activeTab === "orders" && (
            <div className="animate-in">
              <div className="sku-controls glass animate-in">
                <div className="search-wrapper-luxe">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input type="text" placeholder="Search by name, email, or order #..." value={query} onChange={(e) => setQuery(e.target.value)} className="search-input-luxe" />
                </div>
                <div className="filter-group">
                  <LuxeSelect
                    value={statusFilter}
                    options={STATUS_OPTIONS.map(s => ({ value: s, label: s === "all" ? "ALL STATUS" : (ADMIN_STATUS_LABELS[s] || s) }))}
                    onChange={(val) => { setStatusFilter(val); setPage(1); }}
                  />
                </div>
                <div className="results-badge">{total} ORDERS FOUND</div>
              </div>

              <div className="user-grid">
                {loading && <div className="no-results glass-medium full-width">LOADING ORDERS...</div>}
                {!loading && orders.length === 0 && <div className="no-results glass-medium full-width">NO ORDERS FOUND</div>}
                {orders.map((order) => (
                  <div key={order.orderNumber} className={`transaction-summary animate-in glass-medium ${selectedOrder?.orderNumber === order.orderNumber ? "active" : ""}`} onClick={() => openOrder(order.orderNumber)}>
                    <div className="transaction-summary-left">
                      <div className="transaction-number">#{order.orderNumber}</div>
                      <div className="transaction-buyer">{order.buyer?.name || order.userId || "GUEST"}</div>
                    </div>
                    <div className="transaction-summary-right">
                      <div className="transaction-total">₱{Number(order.total || 0).toLocaleString()}</div>
                      <div className={`transaction-status transaction-status--${order.status}`}>{order.status}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="sku-pagination" style={{ marginTop: 40 }}>
                <button className="page-btn" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>PREV</button>
                <div className="page-info">Page <strong>{page}</strong> of <strong>{totalPages}</strong></div>
                <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>NEXT</button>
              </div>
            </div>
          )}

          {activeTab === "refunds" && (
            <RefundsTab 
              addToast={addToast} 
              onSelectRefund={setSelectedRefund} 
              selectedRefundId={selectedRefund?._id}
              setAdminNote={setAdminNote}
            />
          )}
        </div>

        <div className="transactions-right">
          {activeTab === "orders" && selectedOrder && (
            <div className="transaction-detail animate-in">
              <div className="detail-header">
                <h3 className="chrome-text">ORDER #{selectedOrder.orderNumber}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className={`transaction-status big transaction-status--${selectedOrder.status}`}>{selectedOrder.status}</div>
                  <button className="modal-close-btn" onClick={closeDetail}>✕</button>
                </div>
              </div>

              {selectedOrder.rider?.name && <RiderInfoCard rider={selectedOrder.rider} />}

              <div className="detail-meta">
                <div><strong>PLACED</strong> {new Date(selectedOrder.timestamp).toLocaleString()}</div>
                <div><strong>UPDATED</strong> {new Date(selectedOrder.updatedAt || selectedOrder.timestamp).toLocaleString()}</div>
                <div><strong>CUSTOMER</strong> {selectedOrder.buyer?.name || "—"} ({selectedOrder.buyer?.email || "—"})</div>
                <div><strong>PHONE</strong> {selectedOrder.buyer?.phone || selectedOrder.deliveryInfo?.phone || "—"}</div>
                <div><strong>PAYMENT</strong> {selectedOrder.paymentMethod || "—"}</div>
                <div><strong>ADDRESS</strong> {buildFullAddress(selectedOrder.deliveryInfo)}</div>
                {selectedOrder.processedBy?.email && (
                  <div style={{ marginTop: 12 }}>
                    <strong>HANDLED BY</strong> <ProcessedByBadge processedBy={selectedOrder.processedBy} />
                  </div>
                )}
              </div>

              <div className="detail-items">
                <h4>PURCHASED ITEMS</h4>
                {selectedOrder.items.map((it, i) => (
                  <div key={`${it.id}_${i}`} className="detail-item glass">
                    <img src={it.image} alt={it.name} />
                    <div>
                      <div className="it-name">{it.name}</div>
                      <p>SIZE: {it.size || "—"} • QTY: {it.quantity}</p>
                      <p>PRICE: ₱{Number(it.price).toLocaleString()}</p>
                      <p style={{ color: 'var(--text-main)', marginTop: 4 }}>TOTAL: ₱{Number((it.price || 0) * (it.quantity || 1)).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="detail-actions">
                <label className="luxe-label">ADMINISTRATIVE ACTION</label>
                <LuxeSelect
                  value={selectedOrder.status}
                  options={Object.entries(ADMIN_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                  onChange={(val) => handleStatusChange(selectedOrder.orderNumber, val)}
                />
              </div>
            </div>
          )}

          {activeTab === "refunds" && selectedRefund && (
            <div className="transaction-detail animate-in">
              <div className="detail-header">
                <h3 className="chrome-text">REFUND REQUEST</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <RefundStatusBadge status={selectedRefund.status} />
                  <button className="modal-close-btn" onClick={closeDetail}>✕</button>
                </div>
              </div>
              
              <div className="detail-meta">
                <div><strong>ORDER #</strong> {selectedRefund.orderNumber}</div>
                <div><strong>CUSTOMER</strong> {selectedRefund.buyer?.name || "—"} ({selectedRefund.buyer?.email || "—"})</div>
                <div><strong>REASON</strong> {selectedRefund.reason}</div>
                {selectedRefund.notes && <div><strong>NOTES</strong> {selectedRefund.notes}</div>}
              </div>

              <div className="refund-media-grid-admin" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, margin: '24px 0' }}>
                {selectedRefund.media?.map((m, i) => (
                  <div key={i} className="refund-admin-thumb glass" style={{ aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden' }}>
                    <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>

              <div className="detail-actions">
                <label className="luxe-label">ADMIN NOTE</label>
                <textarea 
                  className="luxe-textarea" 
                  value={adminNote} 
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Investigation notes..."
                  style={{ width: '100%', height: '100px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '12px', color: '#fff', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="luxe-btn primary flex-1" onClick={() => handleRefundAction(selectedRefund._id, "approved")} disabled={actionLoading}>APPROVE</button>
                  <button className="luxe-btn danger flex-1" onClick={() => handleRefundAction(selectedRefund._id, "rejected")} disabled={actionLoading}>REJECT</button>
                </div>
              </div>
            </div>
          )}

          {((activeTab === "orders" && !selectedOrder) || (activeTab === "refunds" && !selectedRefund)) && (
            <div className="empty-selection-luxe">
              <div className="empty-selection-icon">✦</div>
              <div className="empty-selection-text">SELECT AN ITEM TO VIEW DETAILS</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Transactions;
