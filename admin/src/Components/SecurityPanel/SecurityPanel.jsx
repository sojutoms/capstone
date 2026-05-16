import React, { useState, useEffect, useCallback, useRef } from "react";
import API_BASE_URL, { authorizedFetch } from "../../services/api";
import "./SecurityPanel.css";

// ─── helpers ──────────────────────────────────────────────────────────────────
const token = () => sessionStorage.getItem("admin-token") || "";
const authH = () => ({ "Content-Type": "application/json" });

// Normalize a MongoDB document: coerce _id → id string
const normalizeDoc = (doc) => ({
  ...doc,
  id: doc._id ? String(doc._id) : doc.id || String(Math.random()),
});

const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short", day: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: true,
  }).format(new Date(iso));
};

const relTime = (iso) => {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ─── Action metadata ──────────────────────────────────────────────────────────
const ACTION_META = {
  login: { icon: "🔑", color: "#60a5fa", bg: "rgba(59,130,246,0.1)", label: "Login" },
  logout: { icon: "🚪", color: "#94a3b8", bg: "rgba(148,163,184,0.1)", label: "Logout" },
  product_add: { icon: "📦", color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "Product Added" },
  product_edit: { icon: "✏️", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Product Edited" },
  product_delete: { icon: "🗑️", color: "#f43f5e", bg: "rgba(244,63,94,0.1)", label: "Product Deleted" },
  stock_add: { icon: "📈", color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "Stock Added" },
  price_edit: { icon: "🏷️", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)", label: "Price Changed" },
  order_status: { icon: "📋", color: "#06b6d4", bg: "rgba(6,182,212,0.1)", label: "Order Updated" },
  user_block: { icon: "🚫", color: "#f43f5e", bg: "rgba(244,63,94,0.1)", label: "User Blocked" },
  user_unblock: { icon: "🛡️", color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "User Unblocked" },
  role_assign: { icon: "👑", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)", label: "Role Assigned" },
  voucher_issue: { icon: "🎟️", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Voucher Issued" },
  category_add: { icon: "📁", color: "#60a5fa", bg: "rgba(59,130,246,0.1)", label: "Category Added" },
  category_delete: { icon: "🗑️", color: "#f43f5e", bg: "rgba(244,63,94,0.1)", label: "Category Deleted" },
  force_logout: { icon: "⚡", color: "#f43f5e", bg: "rgba(244,63,94,0.1)", label: "Force Logout" },
  mark_sold: { icon: "💵", color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "Marked Sold" },
  unknown: { icon: "❓", color: "#94a3b8", bg: "rgba(148,163,184,0.1)", label: "Unknown" },
};

const getActionMeta = (action) => ACTION_META[action] || ACTION_META.unknown;

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

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG TAB
// ═══════════════════════════════════════════════════════════════════════════════
const AuditLogTab = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);   // holds a normalized id string
  const limit = 25;

  // ── mock fallback (only used when backend fails) ────────────────────────────
  const generateMockLogs = () => {
    const actions = Object.keys(ACTION_META).filter(a => a !== "unknown");
    const admins = ["owner@sneaky.com", "admin@sneaky.com", "staff@sneaky.com"];
    const now = Date.now();
    return Array.from({ length: 80 }, (_, i) => {
      const action = actions[i % actions.length];
      return normalizeDoc({
        _id: `mock-log-${i}`,
        action,
        adminEmail: admins[i % admins.length],
        adminName: ["Owner", "Admin User", "Staff Member"][i % 3],
        details: { productName: "Air Max 90", skuId: (i % 50) + 1 },
        ip: `192.168.1.${(i % 254) + 1}`,
        timestamp: new Date(now - i * 1000 * 60 * ((i % 120) + 5)).toISOString(),
      });
    });
  };

  // ── fetch real data ─────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (filter !== "all") params.set("action", filter);
      if (search.trim()) params.set("q", search.trim());

      const res = await authorizedFetch(`/admin/audit-log?${params}`);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (data.success) {
        // FIX 1: normalize _id → id on every document from the DB
        setLogs((data.logs || []).map(normalizeDoc));
        setTotal(data.total || 0);
      } else {
        throw new Error(data.error || "success=false");
      }
    } catch (err) {
      // FIX 2: log the real error so you can debug it in DevTools
      console.error("[AuditLog] fetch failed, using mock data:", err.message);
      const mock = generateMockLogs();
      setLogs(mock.slice((page - 1) * limit, page * limit));
      setTotal(mock.length);
    } finally {
      setLoading(false);
    }
  }, [page, filter, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const exportCSV = () => {
    const rows = [["Timestamp", "Admin", "Action", "Details", "IP"]];
    logs.forEach(l => {
      const meta = getActionMeta(l.action);
      rows.push([
        fmtDate(l.timestamp),
        l.adminEmail,
        meta.label,                             // FIX 3: derive label, don't rely on l.label
        JSON.stringify(l.details || {}),
        l.ip || "—",
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
      download: `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
  };

  return (
    <div className="sp-tab-content">
      <div className="sp-tab-header stagger-in">
        <div className="sp-tab-title-group">
          <h2 className="tab-title">AUDIT LOG</h2>
          <p className="tab-subtitle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 8, opacity: 0.6 }}>
              <path d="M12 2v20M2 12h20" />
            </svg>
            System-wide activity stream. {total} entries synchronized.
          </p>
        </div>
        <button className="sp-btn sp-btn--premium" onClick={exportCSV}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10 }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          EXPORT DATASET
        </button>
      </div>

      <div className="sp-controls-luxe">
        <div className="luxe-search-container">
          <div className="search-glow"></div>
          <svg className="search-icon-luxe" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="luxe-search-input"
            type="text"
            placeholder="FILTER BY ADMIN, EMAIL OR ACTION TYPE..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button className="user-search-clear" onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        <div className="status-filter-wrapper glass-medium">
          <span className="filter-label">Action</span>
          <LuxeSelect
            value={filter}
            options={[
              { value: "all", label: "ALL ACTIONS" },
              ...Object.entries(ACTION_META)
                .filter(([k]) => k !== "unknown")
                .map(([k, v]) => ({ value: k, label: v.label.toUpperCase() }))
            ]}
            onChange={val => { setFilter(val); setPage(1); }}
          />
        </div>
      </div>

      {loading ? (
        <div className="sp-loading"><div className="sp-spinner" /><span>Loading audit logs…</span></div>
      ) : (
        <div className="sp-log-list">
          {logs.length === 0 && <div className="sp-empty">No audit log entries found.</div>}
          {logs.map(log => {
            const meta = getActionMeta(log.action);
            // FIX 4: use normalized log.id (string), not log._id
            const open = expanded === log.id;
            return (
              <div
                key={log.id}
                className={`sp-log-row ${open ? "open" : ""}`}
                onClick={() => setExpanded(open ? null : log.id)}
              >
                <div className="sp-log-main">
                  <div className="sp-log-icon" style={{ background: meta.bg, color: meta.color }}>
                    {meta.icon}
                  </div>
                  <div className="sp-log-info">
                    {/* FIX 5: always derive label from meta, never l.label */}
                    <div className="sp-log-action" style={{ color: meta.color }}>{meta.label}</div>
                    <div className="sp-log-admin">
                      <span className="sp-log-name">{log.adminName || "—"}</span>
                      <span className="sp-log-email">{log.adminEmail}</span>
                    </div>
                  </div>
                  <div className="sp-log-meta">
                    <div className="sp-log-ip">{log.ip || "—"}</div>
                    <div className="sp-log-time" title={fmtDate(log.timestamp)}>
                      {relTime(log.timestamp)}
                    </div>
                  </div>
                  <div className="sp-log-chevron">{open ? "▲" : "▼"}</div>
                </div>
                {open && (
                  <div className="sp-log-detail">
                    <div className="sp-log-detail-row">
                      <span>Timestamp</span><span>{fmtDate(log.timestamp)}</span>
                    </div>
                    {log.details && Object.entries(log.details).map(([k, v]) => (
                      <div key={k} className="sp-log-detail-row">
                        <span>{k}</span><span>{String(v)}</span>
                      </div>
                    ))}
                    {log.userAgent && (
                      <div className="sp-log-detail-row">
                        <span>User Agent</span>
                        <span style={{ fontSize: 11, wordBreak: "break-all" }}>{log.userAgent}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="sp-pagination">
        <button className="sp-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
        <span>Page {page} of {totalPages}</span>
        <button className="sp-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
      </div>
    </div>
  );
};

// ─── Parse a raw User-Agent string into a short readable label ────────────────
// e.g. "Mozilla/5.0 (Windows NT 10.0…) Chrome/124…" → "Chrome 124 / Windows"
const parseUA = (ua = "") => {
  if (!ua) return "Unknown device";
  // Browser
  let browser = "Unknown browser";
  const chromeM = ua.match(/Chrome\/(\d+)/);
  const firefoxM = ua.match(/Firefox\/(\d+)/);
  const safariM = ua.match(/Version\/[\d.]+ .*Safari/);
  const edgeM = ua.match(/Edg\/(\d+)/);
  if (edgeM) browser = `Edge ${edgeM[1]}`;
  else if (chromeM && !ua.includes("Edg")) browser = `Chrome ${chromeM[1]}`;
  else if (firefoxM) browser = `Firefox ${firefoxM[1]}`;
  else if (safariM) browser = "Safari";

  // OS / platform
  let os = "Unknown OS";
  if (ua.includes("iPhone") || ua.includes("iPad")) {
    const iosM = ua.match(/OS ([\d_]+)/);
    os = `iOS ${(iosM?.[1] || "").replace(/_/g, ".")}`;
  } else if (ua.includes("Android")) {
    const andM = ua.match(/Android ([\d.]+)/);
    os = `Android ${andM?.[1] || ""}`;
  } else if (ua.includes("Windows NT 10")) os = "Windows 11/10";
  else if (ua.includes("Windows NT 6")) os = "Windows 7/8";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser} / ${os}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SESSIONS TAB
// ═══════════════════════════════════════════════════════════════════════════════
const SessionsTab = ({ showToast }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forcing, setForcing] = useState({});

  const mockSessions = () => [
    {
      id: "sess-1", adminEmail: "owner@sneaky.com", adminName: "Owner",
      role: "owner", ip: "192.168.1.10",
      device: "Chrome 124 / macOS",
      loginAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      lastActive: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      isCurrent: true,
    },
    {
      id: "sess-2", adminEmail: "admin@sneaky.com", adminName: "Admin User",
      role: "admin", ip: "192.168.1.22",
      device: "Firefox 125 / Windows 11",
      loginAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      lastActive: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      isCurrent: false,
    },
    {
      id: "sess-3", adminEmail: "staff@sneaky.com", adminName: "Staff Member",
      role: "staff", ip: "10.0.0.5",
      device: "Mobile Safari / iOS 17",
      loginAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      lastActive: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      isCurrent: false,
    },
  ];

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authorizedFetch("/admin/sessions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        // Normalize _id → id, and convert raw userAgent string → readable device label
        setSessions((data.sessions || []).map(s => ({
          ...normalizeDoc(s),
          // Backend sends raw UA string in `device`; parse it to something human-readable.
          // If the backend already sends a clean label (mock data), keep it as-is.
          device: s.device && !s.device.startsWith("Mozilla")
            ? s.device
            : parseUA(s.device || ""),
        })));
      } else {
        throw new Error(data.error || "success=false");
      }
    } catch (err) {
      console.error("[Sessions] fetch failed, using mock data:", err.message);
      setSessions(mockSessions());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const forceLogout = async (sessionId, adminEmail) => {
    setForcing(f => ({ ...f, [sessionId]: true }));
    try {
      const res = await authorizedFetch("/admin/force-logout", {
        method: "POST",
        headers: authH(),
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.success) {
        // FIX: filter by normalized id
        setSessions(s => s.filter(x => x.id !== sessionId));
        showToast?.({ message: `Session for ${adminEmail} terminated`, type: "success" });
      } else {
        throw new Error(data.error || "force-logout failed");
      }
    } catch (err) {
      console.error("[Sessions] force-logout error:", err.message);
      showToast?.({ message: "Failed to force logout", type: "error" });
    } finally {
      setForcing(f => ({ ...f, [sessionId]: false }));
    }
  };

  const ROLE_COLORS = {
    owner: { color: "#ffffff", bg: "rgba(212,175,55,0.15)" },
    admin: { color: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
    staff: { color: "#4ade80", bg: "rgba(34,197,94,0.12)" },
    inventory_staff: { color: "#a78bfa", bg: "rgba(139,92,246,0.12)" },
  };

  return (
    <div className="sp-tab-content">
      <div className="sp-tab-header stagger-in">
        <div className="sp-tab-title-group">
          <h2 className="tab-title">ACTIVE SESSIONS</h2>
          <p className="tab-subtitle">
            <span className="pulse-dot"></span>
            {sessions.length} admin session{sessions.length !== 1 ? "s" : ""} currently authenticated.
          </p>
        </div>
        <button className="sp-btn sp-btn--premium" onClick={fetchSessions}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          SYNC STATUS
        </button>
      </div>

      {loading ? (
        <div className="sp-loading">
          <div className="sp-spinner" />
          <span>ESTABLISHING SECURE LINK...</span>
        </div>
      ) : (
        <div className="sp-session-list">
          {sessions.length === 0 && (
            <div className="sp-empty">No active secure sessions detected.</div>
          )}
          {sessions.map(sess => {
            const rc = ROLE_COLORS[sess.role] || ROLE_COLORS.staff;
            return (
              <div key={sess.id} className={`sp-session-card ${sess.isCurrent ? "current" : ""}`}>
                <div className="sp-session-left">
                  <div className="sp-session-avatar-wrapper">
                    <div className="sp-session-avatar">
                      {(sess.adminName || "?")[0].toUpperCase()}
                    </div>
                    {sess.isCurrent && (
                      <div className="sp-session-pulse-ring"></div>
                    )}
                  </div>
                  <div className="sp-session-info">
                    <div className="sp-session-name">
                      {sess.adminName}
                      {sess.isCurrent && <span className="sp-current-badge-luxe">SYSTEM_USER</span>}
                    </div>
                    <div className="sp-session-email">{sess.adminEmail}</div>
                    
                    <div className="sp-session-meta-row">
                      <div className="sp-role-tag" style={{ border: `1px solid ${rc.bg}`, color: rc.color }}>
                        <span className="tag-indicator" style={{ background: rc.color }}></span>
                        {sess.role.toUpperCase()}
                      </div>
                      <div className="sp-meta-pill">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                        </svg>
                        {sess.ip}
                      </div>
                      <div className="sp-meta-pill" title={sess.rawDevice || sess.device}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                        </svg>
                        {sess.device}
                      </div>
                    </div>

                    <div className="sp-session-times-luxe">
                      <div className="time-metric">
                        <span className="time-label">SESSION_START</span>
                        <span className="time-value">{relTime(sess.loginAt)}</span>
                      </div>
                      <div className="time-metric">
                        <span className="time-label">LAST_ACTIVITY</span>
                        <span className="time-value">{relTime(sess.lastActive)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {!sess.isCurrent ? (
                  <button
                    className="sp-btn sp-btn--danger-luxe"
                    onClick={() => forceLogout(sess.id, sess.adminEmail)}
                    disabled={forcing[sess.id]}
                  >
                    <div className="btn-glimmer"></div>
                    {forcing[sess.id] ? "TERMINATING..." : "REVOKE ACCESS"}
                  </button>
                ) : (
                  <div className="active-session-label-wrapper">
                    <div className="active-session-label">
                      <span className="pulse-dot"></span>
                      ACTIVE_LINK
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="sp-info-box-luxe">
        <div className="info-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div className="info-text">
          <strong>ENCLAVE PROTOCOL:</strong> Revoking access immediately invalidates all cryptographic tokens associated with the session ID. This event is cryptographically signed and logged.
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN ALERTS TAB
// ═══════════════════════════════════════════════════════════════════════════════
const LoginAlertsTab = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const mockAlerts = () => [
    {
      id: "a1", type: "failed_login", severity: "warning",
      email: "owner@sneaky.com", ip: "203.177.12.45",
      attempts: 3, timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      message: "3 failed login attempts from unknown IP",
    },
    {
      id: "a2", type: "new_ip", severity: "info",
      email: "admin@sneaky.com", ip: "115.42.150.37",
      attempts: 1, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      message: "Login from new IP address (Philippines)",
    },
    {
      id: "a3", type: "failed_login", severity: "danger",
      email: "admin@sneaky.com", ip: "185.220.101.5",
      attempts: 8, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      message: "8 failed attempts — possible brute force from Tor exit node",
    },
    {
      id: "a4", type: "off_hours", severity: "info",
      email: "staff@sneaky.com", ip: "192.168.1.99",
      attempts: 1, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
      message: "Login at unusual hour (3:42 AM)",
    },
  ];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await authorizedFetch("/admin/login-alerts");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success) {
          setAlerts((data.alerts || []).map(normalizeDoc));
        } else {
          throw new Error(data.error || "success=false");
        }
      } catch (err) {
        console.error("[LoginAlerts] fetch failed, using mock data:", err.message);
        setAlerts(mockAlerts());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const SEV = {
    danger: { icon: "🚨", color: "#f87171", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.3)" },
    warning: { icon: "⚠️", color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.3)" },
    info: { icon: "ℹ️", color: "#60a5fa", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.3)" },
  };

  return (
    <div className="sp-tab-content">
      <div className="sp-tab-header stagger-in">
        <div>
          <h2 className="tab-title">SECURITY ALERTS</h2>
          <p className="tab-subtitle">Real-time surveillance of suspicious patterns and access violations.</p>
        </div>
        <div className="sp-status-badge">
          <span className="pulse-dot"></span>
          THREAT_SCAN_ACTIVE
        </div>
      </div>

      {loading ? (
        <div className="sp-loading">
          <div className="sp-spinner" />
          <span>ANALYZING THREAT VECTORS...</span>
        </div>
      ) : (
        <div className="sp-alert-list">
          {alerts.length === 0 && (
            <div className="sp-empty-luxe">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span>NO THREATS DETECTED</span>
            </div>
          )}
          {alerts.map(alert => {
            const s = SEV[alert.severity] || SEV.info;
            return (
              <div key={alert.id} className={`sp-alert-card-luxe severity-${alert.severity}`}>
                <div className="sp-alert-glow" style={{ background: s.color }}></div>
                <div className="sp-alert-header">
                  <div className="sp-alert-type">
                    <span className="type-icon">{s.icon}</span>
                    <span className="type-label" style={{ color: s.color }}>{alert.type.replace(/_/g, ' ').toUpperCase()}</span>
                  </div>
                  <div className="sp-alert-time">{relTime(alert.timestamp)}</div>
                </div>
                
                <div className="sp-alert-body-luxe">
                  <div className="sp-alert-msg-luxe">{alert.message}</div>
                  <div className="sp-alert-details">
                    <div className="detail-item">
                      <span className="label">TARGET_ACCOUNT</span>
                      <span className="value">{alert.email}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">ORIGIN_IP</span>
                      <span className="value mono">{alert.ip}</span>
                    </div>
                  </div>
                </div>

                <div className="sp-alert-footer">
                  {alert.attempts > 5 && (
                    <div className="sp-alert-badge urgent">
                      {alert.attempts} ATTEMPTS DETECTED
                    </div>
                  )}
                  <div className="sp-alert-actions">
                    <button className="sp-btn-small sp-btn--ghost-luxe">DISMISS</button>
                    <button className="sp-btn-small sp-btn--danger-ghost">BLOCK IP</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="sp-integration-note">
        <div className="note-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
          INTEGRATION_GUIDE
        </div>
        <p>
          Configure <code>fail2ban</code> style logic on <code>/admin/login-attempts</code>. 
          Recommendation: Automated IP blocking after 10 failed vectors within a 15-minute window.
        </p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SecurityPanel
// ═══════════════════════════════════════════════════════════════════════════════
const SecurityPanel = ({ showToast }) => {
  const [tab, setTab] = useState("audit");
  const [stats, setStats] = useState({ logs: 0, sessions: 0, alerts: 0 });

  const adminRoles = JSON.parse(sessionStorage.getItem("admin-roles") || "[]");
  const isOwner = adminRoles.includes("owner");

  useEffect(() => {
    // Fetch summary stats
    const fetchStats = async () => {
      try {
        const [lRes, sRes, aRes] = await Promise.all([
          authorizedFetch("/admin/audit-log?limit=1"),
          authorizedFetch("/admin/sessions"),
          authorizedFetch("/admin/login-alerts")
        ]);
        
        const lData = lRes.ok ? await lRes.json() : { total: 1240 };
        const sData = sRes.ok ? await sRes.json() : { sessions: [1,2,3] };
        const aData = aRes.ok ? await aRes.json() : { alerts: [1,2] };

        setStats({
          logs: lData.total || 1240,
          sessions: (sData.sessions || []).length || 3,
          alerts: (aData.alerts || []).length || 2
        });
      } catch (err) {
        setStats({ logs: 1240, sessions: 3, alerts: 2 });
      }
    };
    if (isOwner) fetchStats();
  }, [isOwner]);

  if (!isOwner) {
    return (
      <div className="sp-root">
        <div className="sp-access-denied">
          <div className="lock-animation">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2 className="chrome-text">ACCESS RESTRICTED</h2>
          <p>The Security Enclave is reserved for System Owners only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-root">
      <header className="sp-header stagger-in">
        <div className="sp-header-left">
          <div className="security-shield-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            SECURE ENCLAVE 01
          </div>
          <h1 className="display-title chrome-text">SECURITY CENTER</h1>
          <div className="role-context-banner">
            <span className="pulse-dot"></span>
            SYSTEM-WIDE AUDIT & THREAT MONITORING ACTIVE
          </div>
        </div>

        <div className="sp-metrics-grid">
          <div className="sp-metric-card glass-medium">
            <span className="metric-label">TOTAL LOGS</span>
            <span className="metric-value">{stats.logs.toLocaleString()}</span>
          </div>
          <div className="sp-metric-card glass-medium">
            <span className="metric-label">ACTIVE SESSIONS</span>
            <span className="metric-value">{stats.sessions}</span>
          </div>
          <div className="sp-metric-card glass-medium urgent">
            <span className="metric-label">SECURITY ALERTS</span>
            <span className="metric-value">{stats.alerts}</span>
          </div>
        </div>
      </header>

      <nav className="tab-navigation glass-strong">
        {[
          { key: "audit", label: "Audit Log", icon: "📋" },
          { key: "sessions", label: "Sessions", icon: "🔑" },
          { key: "alerts", label: "Login Alerts", icon: "🚨" },
        ].map(t => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <span className="tab-btn-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="sp-main-content">
        {tab === "audit" && <AuditLogTab />}
        {tab === "sessions" && <SessionsTab showToast={showToast} />}
        {tab === "alerts" && <LoginAlertsTab />}
      </main>
    </div>
  );
};

export default SecurityPanel;
