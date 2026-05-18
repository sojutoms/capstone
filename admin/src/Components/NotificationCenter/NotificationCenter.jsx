import React, {
  useState, useEffect, useRef, useCallback, createContext, useContext
} from "react";
import { useNavigate } from "react-router-dom";
import "./NotificationCenter.css";

import API_BASE_URL, { authorizedFetch } from "../../services/api";

// ─── Context so other components can push notifications ───────────────────────
export const NotifContext = createContext(null);
export const useNotif = () => useContext(NotifContext);

// ─── Notification types config ────────────────────────────────────────────────
const TYPES = {
  low_stock: { icon: "⚠️", color: "#050505", bg: "rgba(255,255,255,0.12)", label: "Low Stock", path: "/products" },
  out_of_stock: { icon: "🚨", color: "#050505", bg: "rgba(255,255,255,0.15)", label: "Out of Stock", path: "/products" },
  new_order: { icon: "🛒", color: "#050505", bg: "rgba(255,255,255,0.12)", label: "New Order", path: "/admin/transactions" },
  refund_request: { icon: "💸", color: "#050505", bg: "rgba(255,255,255,0.12)", label: "Refund Request", path: "/admin/transactions" },
  security_alert: { icon: "🔐", color: "#050505", bg: "rgba(255,255,255,0.15)", label: "Security Alert", path: "/security" },
  info: { icon: "ℹ️", color: "#050505", bg: "rgba(255,255,255,0.12)", label: "Info", path: "/dashboard" },
};

const POLL_INTERVAL = 30_000; // 30 seconds
const SIMPLE_CATEGORIES = ["bags", "collectibles"];

const isSimple = (cat) => SIMPLE_CATEGORIES.includes((cat || "").toLowerCase());

// ─── Build notifications from product data ────────────────────────────────────
const buildProductNotifs = (products) => {
  const notifs = [];
  const now = new Date().toISOString();

  products.forEach(p => {
    if (p.isDeleted) return;

    if (isSimple(p.category)) {
      const qty = Number(p.stock || 0);
      if (qty === 0) {
        notifs.push({
          id: `out-${p.id}`,
          type: "out_of_stock",
          title: `${p.name} is out of stock`,
          body: `SKU #${p.id} · ${(p.category || "").toUpperCase()}`,
          timestamp: now,
          read: false,
          data: { productId: p.id },
        });
      } else if (qty <= 3) {
        notifs.push({
          id: `low-${p.id}`,
          type: "low_stock",
          title: `Low stock: ${p.name}`,
          body: `Only ${qty} unit${qty !== 1 ? "s" : ""} left · SKU #${p.id}`,
          timestamp: now,
          read: false,
          data: { productId: p.id },
        });
      }
    } else {
      const sizes = Array.isArray(p.sizes)
        ? p.sizes
        : Object.entries(p.sizes || {}).map(([size, v]) => ({ size, ...(typeof v === "object" ? v : { quantity: Number(v) }) }));

      const lowSizes = sizes.filter(s => { const q = Number(s.quantity || 0); return q > 0 && q <= 3; });
      const outSizes = sizes.filter(s => Number(s.quantity || 0) === 0);

      if (outSizes.length > 0) {
        notifs.push({
          id: `out-${p.id}`,
          type: "out_of_stock",
          title: `Out of stock sizes: ${p.name}`,
          body: `${outSizes.length} size${outSizes.length > 1 ? "s" : ""} at 0 · SKU #${p.id}`,
          timestamp: now,
          read: false,
          data: { productId: p.id },
        });
      } else if (lowSizes.length > 0) {
        notifs.push({
          id: `low-${p.id}`,
          type: "low_stock",
          title: `Low stock: ${p.name}`,
          body: `Sizes ${lowSizes.map(s => s.size).join(", ")} running low · SKU #${p.id}`,
          timestamp: now,
          read: false,
          data: { productId: p.id },
        });
      }
    }
  });

  return notifs;
};

// ─── Build notifications from orders ─────────────────────────────────────────
const buildOrderNotifs = (orders) => {
  const notifs = [];
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;

  orders.forEach(o => {
    if (o.status === "refund_requested") {
      notifs.push({
        id: `refund-${o.orderNumber}`,
        type: "refund_request",
        title: `Refund requested on Order #${o.orderNumber}`,
        body: `${o.buyer?.name || "Customer"} · ₱${Number(o.total || 0).toLocaleString()}`,
        timestamp: o.updatedAt || o.timestamp,
        read: false,
        data: { orderNumber: o.orderNumber },
      });
    }
    if (o.status === "pending" && new Date(o.timestamp).getTime() > fiveMinAgo) {
      notifs.push({
        id: `order-${o.orderNumber}`,
        type: "new_order",
        title: `New order: #${o.orderNumber}`,
        body: `${o.buyer?.name || "Customer"} · ₱${Number(o.total || 0).toLocaleString()}`,
        timestamp: o.timestamp,
        read: false,
        data: { orderNumber: o.orderNumber },
      });
    }
  });

  return notifs;
};

// ─── Main NotificationCenter ──────────────────────────────────────────────────
const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const navigate = useNavigate();
  const pollRef = useRef(null);

  // Track read state in localStorage so it persists across renders
  const readKey = "admin-notif-read";
  const getReadIds = () => {
    try { return new Set(JSON.parse(localStorage.getItem(readKey) || "[]")); }
    catch { return new Set(); }
  };
  const saveReadIds = (ids) => {
    localStorage.setItem(readKey, JSON.stringify([...ids]));
  };

  const fetchAll = useCallback(async () => {
    if (!sessionStorage.getItem("admin-token")) return;
    setLoading(true);
    try {
      const readIds = getReadIds();
      const notifs = [];

      // Products
      const pRes = await authorizedFetch("/allproducts");
      const pData = await pRes.json();
      if (Array.isArray(pData)) {
        notifs.push(...buildProductNotifs(pData));
      }

      // Orders
      try {
        const oRes = await authorizedFetch("/admin/orders?limit=30");
        const oData = await oRes.json();
        if (oData.success) {
          notifs.push(...buildOrderNotifs(oData.orders || []));
        }
      } catch { /* orders endpoint optional */ }

      // Mark previously read
      const final = notifs.map(n => ({ ...n, read: readIds.has(n.id) }));

      // Deduplicate by id (keep newest)
      const deduped = Object.values(
        final.reduce((acc, n) => { acc[n.id] = n; return acc; }, {})
      );

      // Sort: unread first, then by timestamp desc
      deduped.sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1;
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      setNotifications(deduped);
    } catch (err) {
      console.warn("[NotifCenter] fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchAll]);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = useCallback((id) => {
    const ids = getReadIds();
    ids.add(id);
    saveReadIds(ids);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    const ids = getReadIds();
    notifications.forEach(n => ids.add(n.id));
    saveReadIds(ids);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, [notifications]);

  const handleClick = (notif) => {
    markRead(notif.id);
    setOpen(false);
    const cfg = TYPES[notif.type] || TYPES.info;
    if (cfg.path) navigate(cfg.path);
  };

  const relTime = (iso) => {
    if (!iso) return "—";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Group by type label
  const grouped = {};
  notifications.forEach(n => {
    const label = TYPES[n.type]?.label || "Other";
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(n);
  });

  return (
    <div className="nc-root" ref={panelRef}>
      {/* Bell button */}
      <button
        className={`nc-bell ${unreadCount > 0 ? "has-unread" : ""}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        title="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="nc-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
        {loading && <span className="nc-loading-dot" />}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="nc-panel">
          <div className="nc-panel-header">
            <div>
              <div className="nc-panel-title">Notifications</div>
              {unreadCount > 0 && (
                <div className="nc-panel-sub">{unreadCount} unread</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {unreadCount > 0 && (
                <button className="nc-action-btn" onClick={markAllRead}>
                  Mark all read
                </button>
              )}
              <button className="nc-action-btn" onClick={() => { setOpen(false); fetchAll(); }}>
                🔄
              </button>
            </div>
          </div>

          <div className="nc-list">
            {notifications.length === 0 && !loading && (
              <div className="nc-empty">
                <div className="nc-empty-icon">🔔</div>
                <div>All clear — no notifications</div>
              </div>
            )}

            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="nc-group-label">{group} ({items.length})</div>
                {items.map(notif => {
                  const cfg = TYPES[notif.type] || TYPES.info;
                  return (
                    <div
                      key={notif.id}
                      className={`nc-item ${notif.read ? "read" : "unread"}`}
                      onClick={() => handleClick(notif)}
                    >
                      <div className="nc-item-icon" style={{ background: cfg.bg, color: cfg.color }}>
                        {cfg.icon}
                      </div>
                      <div className="nc-item-body">
                        <div className="nc-item-title">{notif.title}</div>
                        <div className="nc-item-body-text">{notif.body}</div>
                        <div className="nc-item-time">{relTime(notif.timestamp)}</div>
                      </div>
                      {!notif.read && <div className="nc-unread-dot" />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="nc-panel-footer">
            <button
              className="nc-footer-btn"
              onClick={() => { setOpen(false); navigate("/products"); }}
            >
              View all inventory alerts →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
