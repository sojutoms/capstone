import React, { useEffect, useRef, useState, useCallback } from "react";
import "./Admin.css";
import Sidebar from "../../Components/Sidebar/Sidebar";
import { Route, Routes, useNavigate } from "react-router-dom";
import AddProduct        from "../../Components/AddProduct/AddProduct";
import AdminSales        from "../../Components/Sales/AdminSales";
import UserManagement    from "../../Components/userManagement/userManagement";
import Transactions      from "../../Components/Transactions/Transaction";
import Dashboard         from "../../Components/Dashboard/Dashboard";
import SKUViewer         from "../../Components/SKUviewer/SKUviewer";
import ProductManagement from "../../Components/productManagement/productManagement";
import CommandPalette    from "../../Components/CommandPalette/CommandPalette";
import OperationsPanel   from "../../Components/OperationsPanel/OperationsPanel";
import SecurityPanel     from "../../Components/SecurityPanel/SecurityPanel";

const IDLE_TIMEOUT_MS = 3 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

const clearAdminSession = () => {
  sessionStorage.removeItem("admin-token");
  sessionStorage.removeItem("admin-roles");
  sessionStorage.removeItem("admin-name");
};

/* ─── Toast ──────────────────────────────────────────────────────────────── */
const Toast = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, toast.duration === 0 ? 999999 : (toast.duration || 3000));
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className={`toast-message ${toast.type || "info"}`}>
      {toast.message}
      {toast.actions && (
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {toast.actions.map((action, i) => (
            <button
              key={i}
              onClick={() => { action.onClick(); onDismiss(); }}
              style={{
                background: action.variant === "danger" ? "var(--accent-red)" : "var(--bg-hover)",
                color: action.variant === "danger" ? "white" : "var(--text-secondary)",
                padding: "4px 8px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Idle Modal ─────────────────────────────────────────────────────────── */
const IdleModal = ({ onLogout }) => (
  <div className="idle-overlay">
    <div className="idle-modal">
      <div className="idle-modal__body">
        <div className="idle-modal__header">
          <div className="idle-modal__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8"  x2="12"    y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <p className="idle-modal__title">Session Expired</p>
            <p className="idle-modal__subtitle">
              You have been inactive for a while. Please sign in again to continue.
            </p>
          </div>
        </div>
      </div>
      <div className="idle-modal__actions">
        <button className="idle-modal__btn idle-modal__btn--logout" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </div>
  </div>
);

/* ─── Admin ──────────────────────────────────────────────────────────────── */
const Admin = () => {
  const navigate     = useNavigate();
  const idleTimer    = useRef(null);
  const showModalRef = useRef(false);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast]         = useState(null);

  const showToast = useCallback((t) => setToast(t), []);
  const dismissToast = useCallback(() => setToast(null), []);

  const logout = useCallback(() => {
    clearAdminSession();
    showModalRef.current = false;
    setShowModal(false);
    navigate("/login");
  }, [navigate]);

  const resetIdleTimer = useCallback(() => {
    if (showModalRef.current) return;
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      showModalRef.current = true;
      setShowModal(true);
    }, IDLE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem("admin-token");
    if (!token) {
      navigate("/login");
      return;
    }

    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, resetIdleTimer));
    idleTimer.current = setTimeout(() => {
      showModalRef.current = true;
      setShowModal(true);
    }, IDLE_TIMEOUT_MS);

    return () => {
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, resetIdleTimer));
      clearTimeout(idleTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <CommandPalette />

      {showModal && <IdleModal onLogout={logout} />}
      <Toast toast={toast} onDismiss={dismissToast} />

      <div className="admin">
        <Sidebar />
        <div className="admin-content">
          <Routes>
            <Route path="/dashboard"          element={<Dashboard />} />
            <Route path="/addproduct"         element={<AddProduct />} />
            <Route path="/admin-sales"        element={<AdminSales />} />
            <Route path="/products"           element={<ProductManagement />} />
            <Route path="/users"              element={<UserManagement />} />
            <Route path="/admin/transactions" element={<Transactions />} />
            <Route path="/skuviewer"          element={<SKUViewer />} />
            <Route path="/operations"         element={<OperationsPanel />} />
            <Route path="/admin/security"     element={<SecurityPanel showToast={showToast} />} />
          </Routes>
        </div>
      </div>
    </>
  );
};

export default Admin;
