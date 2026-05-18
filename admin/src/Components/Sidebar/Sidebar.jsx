import React from "react";
import "./Sidebar.css";
import { Link, useLocation } from "react-router-dom";

/* ── Inline SVG icons — no asset dependency ── */
const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
  ),
  users: (
    <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  ),
  products: (
    <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
  ),
  sales: (
    <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
  ),
  transactions: (
    <svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
  ),
  sku: (
    <svg viewBox="0 0 24 24"><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>
  ),
  security: (
    <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
  ),
  pos: (
    <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /><path d="M6 7h4M6 11h6" /><rect x="14" y="7" width="4" height="4" rx="1" /></svg>
  ),
};

const NavItem = ({ to, icon, label, active }) => (
  <Link to={to} style={{ textDecoration: "none" }}>
    <div className={`sidebar-item${active ? " active" : ""}`}>
      <span className="sidebar-icon">{icons[icon]}</span>
      <span className="sidebar-label">{label}</span>
    </div>
  </Link>
);

const Sidebar = () => {
  const location = useLocation();
  const path = location.pathname;

  const adminRoles = JSON.parse(sessionStorage.getItem("admin-roles") || "[]");
  const isOwner          = adminRoles.includes("owner");
  const isAdmin          = adminRoles.includes("admin");
  const isStaff          = adminRoles.includes("staff");
  const isInventoryStaff = adminRoles.includes("inventory_staff");

  const canViewDashboard    = isOwner || isAdmin || isStaff || isInventoryStaff;
  const canViewProduct      = isOwner || isAdmin || isStaff || isInventoryStaff;
  const canViewUsers        = isOwner || isAdmin;
  const canViewSales        = isOwner || isAdmin || isStaff;
  const canViewTransactions = isOwner || isAdmin;
  const canViewSKU          = isOwner || isAdmin || isStaff || isInventoryStaff;
  const canViewSecurity     = isOwner || isAdmin;
  const canViewPOS          = isOwner || isAdmin || isStaff;

  return (
    <nav className="sidebar">

      {/* Overview group */}
      {(canViewDashboard || canViewSales) && (
        <>
          <span className="sidebar-section-label">Overview</span>

          {canViewDashboard && (
            <NavItem to="/dashboard" icon="dashboard" label="Dashboard" active={path === "/dashboard"} />
          )}
          {canViewSales && (
            <NavItem to="/admin-sales" icon="sales" label="View Sales" active={path === "/admin-sales"} />
          )}
        </>
      )}

      {/* Catalog group */}
      {(canViewProduct || canViewSKU) && (
        <>
          <span className="sidebar-section-label">Catalog</span>

          {canViewProduct && (
            <NavItem to="/products" icon="products" label="Products" active={path === "/products"} />
          )}
          {canViewSKU && (
            <NavItem to="/skuviewer" icon="sku" label="SKU Viewer" active={path === "/skuviewer"} />
          )}
        </>
      )}

      {/* Management group */}
      {(canViewUsers || canViewTransactions) && (
        <>
          <span className="sidebar-section-label">Management</span>

          {canViewUsers && (
            <NavItem to="/users" icon="users" label="Users" active={path === "/users"} />
          )}
          {canViewTransactions && (
            <NavItem to="/admin/transactions" icon="transactions" label="Transactions" active={path === "/admin/transactions"} />
          )}
        </>
      )}

      {/* Security group — owner only */}
      {canViewSecurity && (
        <>
          <span className="sidebar-section-label">Security</span>

          <NavItem to="/admin/security" icon="security" label="Security Panel" active={path === "/admin/security"} />
        </>
      )}

      {/* POS group */}
      {canViewPOS && (
        <>
          <span className="sidebar-section-label">In-Store</span>

          <NavItem to="/admin/pos" icon="pos" label="Point of Sale" active={path === "/admin/pos"} />
        </>
      )}

    </nav>
  );
};

export default Sidebar;
