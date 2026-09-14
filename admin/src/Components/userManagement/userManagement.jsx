import React, { useEffect, useState, useRef } from "react";
import "./userManagement.css";
import API_BASE_URL, { authorizedFetch } from "../../services/api";

// ─── Toast Manager ────────────────────────────────────────────────────────────
const useToastManager = () => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(1);
  const removeToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));
  const showToast = ({ message, type = "info", duration = 4500, actions = [] }) => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, message, type, actions }]);
    if (duration > 0) setTimeout(() => removeToast(id), duration);
    return id;
  };
  return { toasts, showToast, removeToast };
};

const Toasts = ({ toasts, removeToast }) => (
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
                  onClick={() => { try { a.onClick?.(); } catch (e) { } finally { removeToast(t.id); } }}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="toast-close" onClick={() => removeToast(t.id)}>✕</button>
      </div>
    ))}
  </div>
);

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
    <div className={`luxe-select-root ${open ? 'open' : ''} ${openUp ? 'up' : ''}`} ref={rootRef} style={{ minWidth: '180px' }}>
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

// ─── Role Config ──────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  owner: { label: "Owner", class: "role-badge--owner", color: "#fbbf24" },
  admin: { label: "Admin", class: "role-badge--admin", color: "#60a5fa" },
  staff: { label: "Staff", class: "role-badge--staff", color: "#4ade80" },
  inventory_staff: { label: "Inventory Staff", class: "role-badge--inventory", color: "#c084fc" },
};

const STAFF_ROLES = ["owner", "admin", "staff", "inventory_staff"];

const RoleBadge = ({ role }) => {
  const config = ROLE_CONFIG[role];
  if (!config) return null;
  return (
    <span className={`role-badge ${config.class}`}>
      {config.label}
    </span>
  );
};

const AccessDenied = ({ message = "You don't have permission to view this section." }) => (
  <div className="empty-selection glass-medium" style={{ padding: '80px 40px' }}>
    <div className="empty-icon">🔒</div>
    <div className="user-section-title">Access Restricted</div>
    <div style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>{message}</div>
  </div>
);

// ─── Eye Icons ────────────────────────────────────────────────────────────────
const EyeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// ─── Star display ─────────────────────────────────────────────────────────────
const StarDisplay = ({ rating, max = 5 }) => (
  <div className="admin-review-stars" style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
    {Array.from({ length: max }, (_, i) => (
      <span key={i} style={{ color: i < Math.round(rating || 0) ? "#f5a623" : "var(--border-medium)", fontSize: 14 }}>★</span>
    ))}
    <span style={{ fontSize: 12, fontWeight: 800, marginLeft: 6, color: 'var(--text-secondary)' }}>{Number(rating || 0).toFixed(1)}</span>
  </div>
);

// ─── UserManagement Main ────────────────────────────────────────────────────
const UserManagement = () => {
  const adminRoles = JSON.parse(sessionStorage.getItem("admin-roles") || "[]");
  const isOwner = adminRoles.includes("owner");
  const isAdmin = adminRoles.includes("admin");
  const isStaff = adminRoles.includes("staff");

  const CAN = {
    viewUsers: isOwner || isAdmin,
    manageRoles: isOwner || isAdmin,
    viewReviews: isOwner || isAdmin || isStaff,
  };

  const [tab, setTab] = useState("users");
  const [allUsers, setAllUsers] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [reviews, setReviews] = useState([]);
  
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [selectedReviewId, setSelectedReviewId] = useState(null);

  const [userSearch, setUserSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleSearch, setRoleSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  
  const [loading, setLoading] = useState({ users: false, staff: false, reviews: false });
  const [voucherTarget, setVoucherTarget] = useState(null);
  const { toasts, showToast, removeToast } = useToastManager();

  const [pwdNew, setPwdNew] = useState("");
  const [pwdShow, setPwdShow] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdRevealed, setPwdRevealed] = useState("");

  // ── Fetchers ──
  const fetchUsers = async () => {
    setLoading(l => ({...l, users: true}));
    try {
      const res = await authorizedFetch("/allusers");
      const data = await res.json();
      setAllUsers((data || []).filter(u => !(u.roles || []).some(r => STAFF_ROLES.includes(r))));
    } catch { showToast({ message: "Failed to load users", type: "error" }); }
    finally { setLoading(l => ({...l, users: false})); }
  };

  const fetchStaff = async () => {
    setLoading(l => ({...l, staff: true}));
    try {
      const res = await authorizedFetch("/allusers");
      const data = await res.json();
      setStaffUsers((data || []).filter(u => (u.roles || []).some(r => STAFF_ROLES.includes(r))));
    } catch { showToast({ message: "Failed to load staff", type: "error" }); }
    finally { setLoading(l => ({...l, staff: false})); }
  };

  const fetchReviews = async () => {
    setLoading(l => ({...l, reviews: true}));
    try {
      const res = await authorizedFetch("/admin/allreviews");
      const data = await res.json();
      setReviews(Array.isArray(data) ? data : (data.reviews || []));
    } catch { showToast({ message: "Failed to load reviews", type: "error" }); }
    finally { setLoading(l => ({...l, reviews: false})); }
  };

  useEffect(() => {
    fetchUsers();
    fetchStaff();
    fetchReviews();
  }, []);

  // ── Filtering ──
  const filteredUsers = allUsers.filter(u => {
    const q = userSearch.toLowerCase();
    const matchQ = q === "" || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchS = statusFilter === "all" ? true : statusFilter === "blocked" ? u.status === "blocked" : u.status !== "blocked";
    return matchQ && matchS;
  }).sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const filteredStaff = staffUsers.filter(u => {
    const q = roleSearch.toLowerCase();
    const matchQ = q === "" || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchR = roleFilter === "all" ? true : (u.roles || []).includes(roleFilter);
    return matchQ && matchR;
  });

  const filteredReviews = reviews.filter(r => {
    const q = userSearch.toLowerCase(); // Reuse search for reviews
    return q === "" || r.userName?.toLowerCase().includes(q) || r.productName?.toLowerCase().includes(q) || r.review?.toLowerCase().includes(q);
  });

  // ── Selection Logic ──
  const selectedUser = allUsers.find(u => u.id === selectedUserId);
  const selectedStaff = staffUsers.find(u => u.id === selectedStaffId);
  const selectedReview = reviews.find(r => (r._id || r.id) === selectedReviewId);

  // ── Actions ──
  const toggleBlockUser = async (user) => {
    const block = user.status !== "blocked";
    showToast({
      message: `${block ? "Block" : "Unblock"} user "${user.name}"?`, type: "warning", duration: 0,
      actions: [
        { label: "Cancel", variant: "muted", onClick: () => {} },
        { label: block ? "Block" : "Unblock", variant: "danger", onClick: async () => {
          try {
            await authorizedFetch("/blockuser", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: user.id, block }),
            });
            await fetchUsers();
            showToast({ message: `User ${block ? "blocked" : "unblocked"}`, type: "success" });
          } catch { showToast({ message: "Failed to update user", type: "error" }); }
        }},
      ]
    });
  };

  const deleteReview = async (review) => {
    const rid = review._id || review.id;
    showToast({
      message: `Delete review by ${review.userName}?`, type: "warning", duration: 0,
      actions: [
        { label: "Cancel", variant: "muted", onClick: () => {} },
        { label: "Delete", variant: "danger", onClick: async () => {
          try {
            const res = await authorizedFetch(`/admin/deletereview/${rid}`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
              setReviews(prev => prev.filter(r => (r._id || r.id) !== rid));
              showToast({ message: "Review deleted", type: "success" });
            }
          } catch { showToast({ message: "Delete failed", type: "error" }); }
        }},
      ]
    });
  };

  const assignRole = async (userId, roles) => {
    try {
      const res = await authorizedFetch("/admin/assign-role", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, roles }),
      });
      if ((await res.json()).success) {
        await fetchStaff(); await fetchUsers();
        showToast({ message: "Role updated", type: "success" });
      }
    } catch { showToast({ message: "Update failed", type: "error" }); }
  };

  useEffect(() => {
    setPwdNew(""); setPwdShow(false); setPwdRevealed(""); setPwdBusy(false);
  }, [selectedStaffId]);

  const generateStrongPassword = () => {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghjkmnpqrstuvwxyz";
    const nums  = "23456789";
    const syms  = "!@#$%^&*?";
    const all   = upper + lower + nums + syms;
    const pick  = (set) => set[Math.floor(Math.random() * set.length)];
    const chars = [pick(upper), pick(lower), pick(nums), pick(syms)];
    for (let i = 0; i < 10; i++) chars.push(pick(all));
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
  };

  const submitStaffPasswordReset = async (staff, newPassword) => {
    setPwdBusy(true);
    try {
      const res = await authorizedFetch(`/admin/staff/${staff.id}/set-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setPwdRevealed(newPassword);
        setPwdNew("");
        showToast({ message: `Password reset for ${staff.name}`, type: "success" });
      } else {
        showToast({ message: data.error || "Failed to reset password", type: "error" });
      }
    } catch {
      showToast({ message: "Network error", type: "error" });
    } finally {
      setPwdBusy(false);
    }
  };

  const handleResetPassword = (staff) => {
    if (!/^.{8,}$/.test(pwdNew) || !/[A-Z]/.test(pwdNew) || !/[0-9]/.test(pwdNew) || !/[^A-Za-z0-9]/.test(pwdNew)) {
      showToast({ message: "Password must be 8+ chars with uppercase, number, and special.", type: "error" });
      return;
    }
    showToast({
      message: `Reset "${staff.name}"'s password? This immediately signs them out and requires them to use the new password.`,
      type: "warning", duration: 0,
      actions: [
        { label: "Cancel", variant: "muted", onClick: () => {} },
        { label: "Reset", variant: "danger", onClick: () => submitStaffPasswordReset(staff, pwdNew) },
      ],
    });
  };

  const handleRoleToggle = (user, role) => {
    const currentRoles = user.roles || [];
    const isAssigned = currentRoles.includes(role);
    const newRoles = isAssigned ? currentRoles.filter((r) => r !== role) : [role];
    showToast({
      message: `${newRoles.length === 0 ? `Remove all roles from` : `Set role to "${ROLE_CONFIG[role]?.label}"`} for "${user.name}"?`,
      type: "warning", duration: 0,
      actions: [
        { label: "Cancel", variant: "muted", onClick: () => {} },
        { label: "Confirm", variant: "success", onClick: () => assignRole(user.id, newRoles) },
      ],
    });
  };

  // ── Render Helpers ──
  const renderTabNavigation = () => (
    <div className="tab-navigation">
      <button className={`tab-btn ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>CUSTOMERS</button>
      {CAN.manageRoles && (
        <button className={`tab-btn ${tab === "roles" ? "active" : ""}`} onClick={() => setTab("roles")}>STAFF</button>
      )}
      {CAN.viewReviews && (
        <button className={`tab-btn ${tab === "reviews" ? "active" : ""}`} onClick={() => setTab("reviews")}>REVIEWS</button>
      )}
    </div>
  );

  return (
    <div className="user-management animate-in">
      <Toasts toasts={toasts} removeToast={removeToast} />
      
      {voucherTarget && (
        <GiveVoucherModal user={voucherTarget} onClose={() => setVoucherTarget(null)} showToast={showToast} />
      )}

      <div className="user-management-header">
        <div className="user-management-title-group">
          <h1 className="chrome-text" style={{ fontSize: '32px', margin: 0 }}>AUTHORITY PANEL</h1>
          <span className={`role-context-banner ${isOwner ? "owner" : "admin"}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            {isOwner ? "PLATFORM OWNER" : isAdmin ? "ADMINISTRATOR" : "STAFF MEMBER"}
          </span>
        </div>
        {renderTabNavigation()}
      </div>

      <div className="users-content-split">
        {/* ── LEFT PANE: LIST ── */}
        <div className="users-left">
          <div className="sku-controls animate-in glass">
            <div className="search-wrapper-luxe">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input 
                type="text" 
                placeholder={`Search ${tab}...`} 
                value={tab === "roles" ? roleSearch : userSearch} 
                onChange={(e) => tab === "roles" ? setRoleSearch(e.target.value) : setUserSearch(e.target.value)} 
                className="search-input-luxe" 
              />
            </div>
            {tab === "users" && (
              <LuxeSelect 
                value={statusFilter} 
                options={[
                  { value: "all", label: `ALL (${allUsers.length})` },
                  { value: "active", label: "ACTIVE" },
                  { value: "blocked", label: "BLOCKED" }
                ]}
                onChange={setStatusFilter}
              />
            )}
            {tab === "roles" && (
              <LuxeSelect 
                value={roleFilter} 
                options={[
                  { value: "all", label: "ALL ROLES" },
                  { value: "admin", label: "ADMINS" },
                  { value: "staff", label: "STAFF" },
                  { value: "inventory_staff", label: "INVENTORY" }
                ]}
                onChange={setRoleFilter}
              />
            )}
          </div>

          <div className="users-list-scroll">
            {tab === "users" && CAN.viewUsers && (
              filteredUsers.map(u => (
                <div key={u.id} className={`user-summary-card ${selectedUserId === u.id ? 'selected' : ''}`} onClick={() => setSelectedUserId(u.id)}>
                  <div className="user-avatar-sm">{u.name?.[0]?.toUpperCase() || "?"}</div>
                  <div className="user-summary-info">
                    <div className="user-summary-name">
                      {u.name}
                      <span className={`status-dot ${u.status === 'blocked' ? 'blocked' : 'active'}`} />
                    </div>
                    <div className="user-summary-email">{u.email}</div>
                  </div>
                  <div className="user-badge-group">
                    <span className="role-badge" style={{ fontSize: '8px' }}>{u.orderCount || 0} ORDERS</span>
                  </div>
                </div>
              ))
            )}

            {tab === "roles" && CAN.manageRoles && (
              filteredStaff.map(u => (
                <div key={u.id} className={`user-summary-card ${selectedStaffId === u.id ? 'selected' : ''}`} onClick={() => setSelectedStaffId(prev => prev === u.id ? null : u.id)}>
                  <div className="user-avatar-sm" style={{ borderColor: ROLE_CONFIG[u.roles?.[0]]?.color }}>{u.name?.[0]?.toUpperCase() || "?"}</div>
                  <div className="user-summary-info">
                    <div className="user-summary-name">{u.name}</div>
                    <div className="user-summary-email">{u.email}</div>
                  </div>
                  <div className="user-badge-group">
                    {u.roles?.map(r => <RoleBadge key={r} role={r} />)}
                  </div>
                </div>
              ))
            )}

            {tab === "reviews" && CAN.viewReviews && (
              filteredReviews.map(r => (
                <div key={r._id || r.id} className={`user-summary-card ${selectedReviewId === (r._id || r.id) ? 'selected' : ''}`} onClick={() => setSelectedReviewId(r._id || r.id)}>
                  <div className="user-avatar-sm">
                    {r.productImage ? <img src={r.productImage} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : (r.userName?.[0] || "?")}
                  </div>
                  <div className="user-summary-info">
                    <div className="user-summary-name">{r.userName || "Anonymous"}</div>
                    <div className="user-summary-email" style={{ fontStyle: 'italic' }}>"{r.productName?.slice(0, 30)}..."</div>
                  </div>
                  <StarDisplay rating={r.rating} />
                </div>
              ))
            )}
            
            {loading[tab === "roles" ? "staff" : tab] && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 800 }}>LOADING DATA...</div>}
          </div>
        </div>

        {/* ── RIGHT PANE: DETAILS ── */}
        <div className="users-right">
          {tab === "users" && (
            selectedUser ? (
              <div className="user-detail-panel animate-in">
                <div className="user-detail-header">
                  <div className="user-avatar-lg">{(selectedUser.name || "?")[0].toUpperCase()}</div>
                  <div>
                    <h2 className="chrome-text" style={{ fontSize: '28px', margin: '0 0 4px 0' }}>{selectedUser.name}</h2>
                    <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '14px', fontWeight: 600 }}>{selectedUser.email}</p>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <span className={`role-badge ${selectedUser.status === 'blocked' ? 'role-badge--owner' : 'role-badge--staff'}`} 
                        style={{ background: selectedUser.status === 'blocked' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', color: selectedUser.status === 'blocked' ? '#f87171' : '#4ade80' }}>
                        {selectedUser.status === 'blocked' ? 'BLOCKED' : 'ACTIVE CUSTOMER'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="user-detail-body">
                  <div className="user-section-title">CORE ACCOUNT DATA</div>
                  <div className="user-stats-grid">
                    <div className="user-stat-card">
                      <div className="user-stat-label">TOTAL ORDERS</div>
                      <div className="user-stat-value">{selectedUser.orderCount || 0}</div>
                    </div>
                    <div className="user-stat-card">
                      <div className="user-stat-label">PHONE NUMBER</div>
                      <div className="user-stat-value" style={{ fontSize: 14 }}>{selectedUser.phone || "UNSET"}</div>
                    </div>
                    <div className="user-stat-card">
                      <div className="user-stat-label">MEMBER SINCE</div>
                      <div className="user-stat-value" style={{ fontSize: 14 }}>{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : "—"}</div>
                    </div>
                  </div>

                  <div className="user-section-title">RECENT ACTIVITY</div>
                  <div className="purchases-list">
                    {selectedUser.purchases?.length > 0 ? (
                      selectedUser.purchases.map((p, i) => (
                        <div key={i} className="purchase-row">
                          <div className="p-info">
                            <div className="p-name">{p.name}</div>
                            <div className="p-meta">{p.qty} UNIT(S) • {p.date ? new Date(p.date).toLocaleDateString() : "RECENT"}</div>
                          </div>
                          <div className="p-price">₱{p.price?.toLocaleString()}</div>
                        </div>
                      ))
                    ) : <div style={{ color: 'var(--text-tertiary)', fontSize: 12, fontStyle: 'italic' }}>No purchase history found for this user.</div>}
                  </div>

                  <div className="user-actions-row">
                    <button className="sp-btn sp-btn--primary" onClick={() => setVoucherTarget(selectedUser)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 12V8H4v4M20 12v4H4v-4M20 12h2M4 12H2M12 4v16"/></svg>
                      ISSUE VOUCHER
                    </button>
                    {CAN.manageRoles && (
                      <button className="sp-btn sp-btn--danger" onClick={() => toggleBlockUser(selectedUser)}>
                        {selectedUser.status === "blocked" ? "UNBLOCK ACCESS" : "RESTRICT ACCOUNT"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-selection">
                <div className="empty-icon">👥</div>
                <p>Select a customer to view their profile and activity</p>
              </div>
            )
          )}

          {tab === "roles" && (
            selectedStaff ? (
              <div className="user-detail-panel animate-in">
                <div className="user-detail-header">
                  <div className="user-avatar-lg" style={{ borderColor: ROLE_CONFIG[selectedStaff.roles?.[0]]?.color }}>
                    {(selectedStaff.name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="chrome-text" style={{ fontSize: '28px', margin: '0 0 4px 0' }}>{selectedStaff.name}</h2>
                    <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '14px', fontWeight: 600 }}>{selectedStaff.email}</p>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      {selectedStaff.roles?.map(r => <RoleBadge key={r} role={r} />)}
                    </div>
                  </div>
                </div>
                
                <div className="user-detail-body">
                  <div className="user-section-title">ADMINISTRATIVE ACCESS</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
                    Use the controls below to manage this user's permissions. 
                    {selectedStaff.roles?.includes("owner") ? " Owner accounts have immutable full-system access." : " Role changes take effect immediately."}
                  </p>

                  {!selectedStaff.roles?.includes("owner") && (
                    <div className="user-actions-row" style={{ flexWrap: 'wrap' }}>
                      {Object.entries(ROLE_CONFIG).filter(([k]) => k !== "owner").map(([role, config]) => {
                        const hasRole = selectedStaff.roles?.includes(role);
                        return (
                          <button key={role}
                            className={`sp-btn ${hasRole ? "sp-btn--primary" : ""}`}
                            style={{ flex: '0 0 calc(50% - 6px)', background: hasRole ? config.color : 'var(--bg-dark)', color: hasRole ? '#000' : 'var(--text-primary)' }}
                            onClick={() => handleRoleToggle(selectedStaff, role)}>
                            {config.label.toUpperCase()} {hasRole && "✓"}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="user-section-title" style={{ marginTop: 40 }}>PROVISIONING DETAILS</div>
                  <div className="user-stats-grid">
                    <div className="user-stat-card">
                      <div className="user-stat-label">STAFF ID</div>
                      <div className="user-stat-value" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{selectedStaff.id.slice(-8).toUpperCase()}</div>
                    </div>
                    <div className="user-stat-card">
                      <div className="user-stat-label">ACCOUNT STATUS</div>
                      <div className="user-stat-value" style={{ fontSize: 14, color: '#4ade80' }}>VERIFIED</div>
                    </div>
                  </div>

                  {(isOwner || (isAdmin && !selectedStaff.roles?.includes("admin"))) && !selectedStaff.roles?.includes("owner") && (
                    <>
                      <div className="user-section-title" style={{ marginTop: 40 }}>STAFF CREDENTIALS</div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                        Passwords are stored as one-way bcrypt hashes and cannot be viewed — even by the owner. Use the field below to set a new password for this staff account. The plaintext will be shown once immediately after the reset so you can share it with them.
                      </p>

                      {pwdRevealed ? (
                        <div style={{ padding: 16, borderRadius: 10, border: '1px solid #4ade80', background: 'rgba(74,222,128,0.06)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#4ade80' }}>
                            NEW PASSWORD — SHOWN ONCE
                            <button
                              className="sp-btn"
                              style={{ padding: '4px 10px', fontSize: 11 }}
                              onClick={() => setPwdRevealed("")}
                            >
                              I've saved it
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <code style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-dark)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: 1, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                              {pwdRevealed}
                            </code>
                            <button
                              className="sp-btn"
                              style={{ padding: '10px 14px', fontSize: 11 }}
                              onClick={() => { navigator.clipboard?.writeText(pwdRevealed); showToast({ message: "Password copied to clipboard", type: "success" }); }}
                            >
                              Copy
                            </button>
                          </div>
                          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-tertiary)' }}>
                            Give this to <strong>{selectedStaff.name}</strong> now. Once you dismiss this panel it cannot be recovered — you'd have to reset it again.
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 10 }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                              <input
                                type={pwdShow ? "text" : "password"}
                                value={pwdNew}
                                onChange={(e) => setPwdNew(e.target.value)}
                                placeholder="New password (min 8 chars, upper + number + special)"
                                autoComplete="new-password"
                                style={{
                                  width: '100%', padding: '11px 42px 11px 14px',
                                  background: 'var(--bg-dark)', border: '1px solid var(--border-medium)',
                                  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-mono)', boxSizing: 'border-box',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setPwdShow(s => !s)}
                                title={pwdShow ? "Hide password" : "Show password"}
                                style={{
                                  position: 'absolute', top: 0, right: 0, height: '100%', padding: '0 12px',
                                  background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer',
                                }}
                              >
                                {pwdShow ? <EyeOffIcon /> : <EyeIcon />}
                              </button>
                            </div>
                            <button
                              type="button"
                              className="sp-btn"
                              style={{ padding: '0 14px', fontSize: 11, whiteSpace: 'nowrap' }}
                              onClick={() => { const p = generateStrongPassword(); setPwdNew(p); setPwdShow(true); }}
                            >
                              Generate
                            </button>
                          </div>
                          <button
                            type="button"
                            className="sp-btn sp-btn--primary"
                            disabled={pwdBusy || !pwdNew}
                            onClick={() => handleResetPassword(selectedStaff)}
                            style={{ opacity: (pwdBusy || !pwdNew) ? 0.6 : 1, cursor: (pwdBusy || !pwdNew) ? 'not-allowed' : 'pointer' }}
                          >
                            {pwdBusy ? "RESETTING…" : "RESET PASSWORD"}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-selection">
                <div className="empty-icon">🛡️</div>
                <p>Select a staff member to manage their roles and access</p>
                <div style={{ marginTop: 24 }}>
                  <CreateStaffUser showToast={showToast} onCreated={() => { fetchStaff(); fetchUsers(); }} />
                </div>
              </div>
            )
          )}

          {tab === "reviews" && (
            selectedReview ? (
              <div className="user-detail-panel animate-in">
                <div className="user-detail-header" style={{ padding: 24 }}>
                  <div className="user-avatar-lg" style={{ width: 120, height: 120, borderRadius: 16 }}>
                    {selectedReview.productImage ? <img src={selectedReview.productImage} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : "👟"}
                  </div>
                  <div>
                    <h2 className="chrome-text" style={{ fontSize: '20px', margin: '0 0 4px 0' }}>{selectedReview.productName}</h2>
                    <StarDisplay rating={selectedReview.rating} max={5} />
                    <p style={{ margin: '12px 0 0 0', color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 700 }}>REVIEW BY {selectedReview.userName?.toUpperCase() || "ANONYMOUS"}</p>
                    <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '11px' }}>{selectedReview.createdAt ? new Date(selectedReview.createdAt).toLocaleDateString() : "—"}</p>
                  </div>
                </div>

                <div className="user-detail-body">
                  <div className="user-section-title">REVIEW CONTENT</div>
                  <div style={{ background: 'var(--glass-bg)', padding: 24, borderRadius: 16, border: '1px solid var(--border-subtle)', marginBottom: 32 }}>
                    <h3 style={{ fontSize: 16, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>"{selectedReview.title || "User Review"}"</h3>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{selectedReview.review}</p>
                  </div>

                  <div className="user-section-title">CUSTOMER EXPERIENCE</div>
                  <div className="user-stats-grid">
                    <div className="user-stat-card">
                      <div className="user-stat-label">FIT</div>
                      <div className="user-stat-value" style={{ fontSize: 14 }}>{selectedReview.fit || "UNSPECIFIED"}</div>
                    </div>
                    <div className="user-stat-card">
                      <div className="user-stat-label">COMFORT</div>
                      <div className="user-stat-value" style={{ fontSize: 14 }}>{selectedReview.comfort || "UNSPECIFIED"}</div>
                    </div>
                    <div className="user-stat-card">
                      <div className="user-stat-label">RECOMMENDS</div>
                      <div className="user-stat-value" style={{ fontSize: 14, color: String(selectedReview.recommend || "").toLowerCase() === 'yes' ? '#4ade80' : '#f87171' }}>{selectedReview.recommend?.toUpperCase() || "N/A"}</div>
                    </div>
                  </div>

                  <div className="user-actions-row">
                    <button className="sp-btn sp-btn--danger" style={{ flex: 1 }} onClick={() => deleteReview(selectedReview)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      DELETE REVIEW FROM PUBLIC RECORD
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-selection">
                <div className="empty-icon">⭐</div>
                <p>Select a product review to moderate or view details</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Sub-Components (Ported/Refined) ─────────────────────────────────────────

const GiveVoucherModal = ({ user, onClose, showToast }) => {
  const [form, setForm] = useState({ title: "", message: "", discountPercent: "", maxDiscount: "", expiresAt: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => { setForm(p => ({ ...p, [e.target.name]: e.target.value })); setError(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError("Title is required.");
    if (!form.discountPercent) return setError("Discount is required.");
    if (!form.expiresAt) return setError("Expiry date is required.");
    const expiry = new Date(form.expiresAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(expiry.getTime()) || expiry < today) return setError("Expiry date must be today or later.");
    setSaving(true);
    try {
      const res = await authorizedFetch("/admin/give-voucher", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...form }),
      });
      if ((await res.json()).success) {
        showToast({ message: "Voucher issued successfully", type: "success" });
        onClose();
      }
    } catch { setError("Failed to issue voucher."); }
    finally { setSaving(false); }
  };

  return (
    <div className="voucher-overlay animate-in" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="voucher-modal glass-strong">
        <div className="user-section-title">ISSUE VOUCHER TO {user.name}</div>
        <form onSubmit={handleSubmit} className="staff-form-luxe" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="luxe-input-group">
            <label className="luxe-label">TITLE</label>
            <input name="title" value={form.title} onChange={handleChange} className="luxe-input" placeholder="e.g. Loyalty Reward" />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div className="luxe-input-group" style={{ flex: 1 }}>
              <label className="luxe-label">DISCOUNT %</label>
              <input type="number" name="discountPercent" value={form.discountPercent} onChange={handleChange} className="luxe-input" placeholder="10" />
            </div>
            <div className="luxe-input-group" style={{ flex: 1 }}>
              <label className="luxe-label">MAX (₱)</label>
              <input type="number" name="maxDiscount" value={form.maxDiscount} onChange={handleChange} className="luxe-input" placeholder="0 = None" />
            </div>
          </div>
          <div className="luxe-input-group">
            <label className="luxe-label">EXPIRES *</label>
            <input
              type="date"
              name="expiresAt"
              value={form.expiresAt}
              onChange={handleChange}
              className="luxe-input"
              min={new Date().toISOString().split("T")[0]}
              required
            />
          </div>
          {error && <p style={{ color: '#f87171', fontSize: 11, fontWeight: 700 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button type="submit" className="sp-btn sp-btn--primary" disabled={saving}>{saving ? "ISSUING..." : "CONFIRM ISSUE"}</button>
            <button type="button" className="sp-btn" style={{ borderColor: 'var(--border-subtle)' }} onClick={onClose}>CANCEL</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const STAFF_PASSWORD_RULES = [
  { key: "length",  label: "At least 8 characters",         test: (p) => p.length >= 8 },
  { key: "upper",   label: "One uppercase letter (A-Z)",    test: (p) => /[A-Z]/.test(p) },
  { key: "number",  label: "One number (0-9)",              test: (p) => /[0-9]/.test(p) },
  { key: "special", label: "One special character (!@#$…)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const sanitizeStaffName = (v) => v.replace(/[^\p{L}' -]/gu, "").slice(0, 54);

const CreateStaffUser = ({ showToast, onCreated }) => {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "+63", password: "", role: "staff" });
  const [errors, setErrors] = useState({});
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  const pwdChecks = STAFF_PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(form.password) }));

  const setField = (name, value) => {
    if (name === "firstName" || name === "lastName") value = sanitizeStaffName(value);
    else if (name === "phone") {
      let digits = value.replace(/\D/g, "");
      if (!digits.startsWith("63")) digits = "63" + digits.replace(/^6?3?/, "");
      digits = digits.slice(0, 12);
      value = "+" + digits;
    }
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "First name is required.";
    if (!form.lastName.trim())  e.lastName  = "Last name is required.";
    if (!form.email.trim())     e.email     = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Enter a valid email.";
    if (!form.phone || !/^\+63\d{10}$/.test(form.phone)) e.phone = "Phone number must start with +63 and be followed by exactly 10 digits.";
    if (!form.password) e.password = "Password is required.";
    else if (pwdChecks.some((c) => !c.passed)) e.password = "Password does not meet all requirements.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const reset = () => {
    setForm({ firstName: "", lastName: "", email: "", phone: "+63", password: "", role: "staff" });
    setErrors({});
    setShowPwd(false);
  };

  const closeModal = () => { setShow(false); reset(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await authorizedFetch("/admin/create-staff", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${form.firstName.trim()} ${form.lastName.trim()}`,
          email: form.email.trim(),
          phone: form.phone,
          password: form.password,
          role: form.role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast({ message: "Staff created", type: "success" });
        closeModal();
        onCreated();
      } else {
        const msg = String(data.error || data.message || "").toLowerCase();
        if (msg.includes("email")) setErrors((p) => ({ ...p, email: data.error || data.message }));
        else showToast({ message: data.error || data.message || "Failed to create staff", type: "error" });
      }
    } catch { showToast({ message: "Failed to create", type: "error" }); }
    finally { setSaving(false); }
  };

  if (!show) return <button className="sp-btn sp-btn--primary" style={{ width: '100%' }} onClick={() => setShow(true)}>+ PROVISION NEW STAFF</button>;

  return (
    <div className="voucher-overlay animate-in" style={{ zIndex: 3000 }} onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="voucher-modal glass-strong" style={{ maxWidth: 640 }}>
        <div className="user-section-title">PROVISION NEW STAFF</div>
        <form onSubmit={handleSubmit} className="staff-form-luxe" noValidate>
          <div className="luxe-input-group">
            <label className="luxe-label">FIRST</label>
            <input
              name="firstName"
              value={form.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
              className={`luxe-input ${errors.firstName ? "luxe-input-error" : ""}`}
              placeholder="Nicki"
              autoComplete="off"
            />
            {errors.firstName && <span className="luxe-error-text">{errors.firstName}</span>}
          </div>

          <div className="luxe-input-group">
            <label className="luxe-label">LAST</label>
            <input
              name="lastName"
              value={form.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
              className={`luxe-input ${errors.lastName ? "luxe-input-error" : ""}`}
              placeholder="Tomiyama"
              autoComplete="off"
            />
            {errors.lastName && <span className="luxe-error-text">{errors.lastName}</span>}
          </div>

          <div className="luxe-input-group full-width">
            <label className="luxe-label">EMAIL</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className={`luxe-input ${errors.email ? "luxe-input-error" : ""}`}
              placeholder="staff@example.com"
              autoComplete="off"
            />
            {errors.email && <span className="luxe-error-text">{errors.email}</span>}
          </div>

          <div className="luxe-input-group">
            <label className="luxe-label">PHONE</label>
            <input
              name="phone"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              className={`luxe-input ${errors.phone ? "luxe-input-error" : ""}`}
              placeholder="+639XXXXXXXXX"
              inputMode="numeric"
              maxLength={13}
            />
            {errors.phone && <span className="luxe-error-text">{errors.phone}</span>}
          </div>

          <div className="luxe-input-group">
            <label className="luxe-label">ROLE</label>
            <select
              value={form.role}
              onChange={(e) => setField("role", e.target.value)}
              className="luxe-input"
            >
              <option value="admin">ADMIN</option>
              <option value="staff">STAFF</option>
              <option value="inventory_staff">INVENTORY</option>
            </select>
          </div>

          <div className="luxe-input-group full-width">
            <label className="luxe-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>PASSWORD</span>
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer' }}
              >
                {showPwd ? "HIDE" : "SHOW"}
              </button>
            </label>
            <input
              type={showPwd ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              className={`luxe-input ${errors.password ? "luxe-input-error" : ""}`}
              placeholder="Min. 8 chars, upper + number + special"
              autoComplete="new-password"
            />
            {errors.password && <span className="luxe-error-text">{errors.password}</span>}
            {form.password.length > 0 && (
              <div className="luxe-checks">
                {pwdChecks.map((c) => (
                  <div key={c.key} className={`luxe-check ${c.passed ? "luxe-check-pass" : ""}`}>
                    <span className="luxe-check-icon">{c.passed ? "✓" : "✗"}</span>
                    <span>{c.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="user-actions-row full-width">
            <button type="submit" className="sp-btn sp-btn--primary" disabled={saving}>{saving ? "CREATING..." : "CONFIRM"}</button>
            <button type="button" className="sp-btn" style={{ borderColor: 'var(--border-subtle)' }} onClick={closeModal}>CANCEL</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserManagement;
