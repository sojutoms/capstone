import React, { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./CSS/Profile.css";
import API_BASE_URL from "../services/api";
import { FavoritesContext } from "../Context/FavoritesContext";
import { useTheme } from "../Context/ThemeContext";

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const VoucherIcon = () => (
  <svg {...iconProps}>
    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </svg>
);

const KeyIcon = () => (
  <svg {...iconProps}>
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const MoonIcon = () => (
  <svg {...iconProps}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const RulerIcon = () => (
  <svg {...iconProps}>
    <rect x="2" y="8" width="20" height="8" rx="1" />
    <line x1="6" y1="8" x2="6" y2="12" />
    <line x1="10" y1="8" x2="10" y2="12" />
    <line x1="14" y1="8" x2="14" y2="12" />
    <line x1="18" y1="8" x2="18" y2="12" />
  </svg>
);

const ChatIcon = () => (
  <svg {...iconProps}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const LockIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const DocumentIcon = () => (
  <svg {...iconProps}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const LogoutIcon = () => (
  <svg {...iconProps}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const Card = ({ to, onClick, icon, title, desc, rightElement, danger }) => {
  const content = (
    <>
      <span className={`profile-card-icon${danger ? " danger" : ""}`}>{icon}</span>
      <div className="profile-card-body">
        <h4 className={`profile-card-title${danger ? " danger" : ""}`}>{title}</h4>
        {desc && <p className="profile-card-desc">{desc}</p>}
      </div>
      {rightElement}
    </>
  );

  if (to) return <Link to={to} className="profile-card">{content}</Link>;
  return <button type="button" className="profile-card" onClick={onClick}>{content}</button>;
};

const Profile = () => {
  const navigate = useNavigate();
  const { favorites } = useContext(FavoritesContext);
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const [user, setUser] = useState(null);
  const [orderCount, setOrderCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [viewingPhoto, setViewingPhoto] = useState(false);

  const token = localStorage.getItem("auth-token");

  useEffect(() => {
    if (!token) { navigate("/login"); return; }

    const fetchAll = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/profile`, { headers: { "auth-token": token } });
        const data = await res.json();
        if (data.success) setUser(data.user);
      } catch {}

      try {
        const res = await fetch(`${API_BASE_URL}/orderhistory?page=1&limit=1&status=all`, { headers: { "auth-token": token } });
        const data = await res.json();
        if (data.success) setOrderCount(data.total ?? (data.orders || []).length);
      } catch {}

      try {
        const res = await fetch(`${API_BASE_URL}/myreviews`, { headers: { "auth-token": token } });
        const data = await res.json();
        if (data.success) setReviewCount((data.reviews || []).length);
      } catch {}
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.removeItem("auth-token");
      window.location.replace("/");
    }
  };

  const firstName = user?.firstName || (user?.name || "").split(" ")[0] || "";
  const displayName = user
    ? (user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.name) || user.email
    : "";

  const stats = [
    { label: "Orders", value: orderCount, to: "/orderhistory" },
    { label: "Saved", value: favorites.length, to: "/favorites" },
    { label: "Reviews", value: reviewCount, to: "/my-reviews" },
  ];

  if (!user) return null;

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div>
            <p className="profile-eyebrow">ACCOUNT</p>
            <h1 className="profile-title">Hi, {firstName || "there"}</h1>
          </div>
          <Link to="/settings" className="profile-edit-link">Edit Profile →</Link>
        </div>

        <div className="profile-overview glass-strong">
          <div className="profile-overview-identity">
            <div className={`profile-avatar${user.photo ? " profile-avatar--viewable" : ""}`} onClick={() => user.photo && setViewingPhoto(true)}>
              {user.photo ? (
                <img src={user.photo} alt="Profile" />
              ) : (
                <span className="profile-avatar-initial">{(displayName || "U")[0].toUpperCase()}</span>
              )}
            </div>
            <div className="profile-identity-text">
              <h2>{displayName}</h2>
              <p>{user.email}</p>
              {!!user.place && <p className="profile-place">📍 {user.place}</p>}
            </div>
          </div>

          <div className="profile-overview-stats">
            {stats.map((s) => (
              <Link key={s.label} to={s.to} className="profile-stat">
                <span className="profile-stat-value">{s.value}</span>
                <span className="profile-stat-label">{s.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <section className="profile-section">
          <h3 className="profile-section-label">Account</h3>
          <div className="profile-card-grid">
            <Card to="/my-vouchers" icon={<VoucherIcon />} title="Vouchers & Promos" desc="Apply discount codes" />
            <Card to="/settings" icon={<KeyIcon />} title="Change Password" desc="Update your account password" />
          </div>
        </section>

        <section className="profile-section">
          <h3 className="profile-section-label">Preferences</h3>
          <div className="profile-card-grid">
            <Card
              icon={<MoonIcon />}
              title="Dark Mode"
              desc={isDark ? "On" : "Off"}
              onClick={() => setTheme(isDark ? "light" : "dark")}
              rightElement={
                <span className={`profile-toggle${isDark ? " on" : ""}`}>
                  <span className="profile-toggle-thumb" />
                </span>
              }
            />
            <Card to="/size-guide" icon={<RulerIcon />} title="Size Guide" desc="Find your perfect fit" />
          </div>
        </section>

        <section className="profile-section">
          <h3 className="profile-section-label">Support</h3>
          <div className="profile-card-grid profile-card-grid--three">
            <Card to="/contact" icon={<ChatIcon />} title="Contact Us" />
            <Card to="/privacy" icon={<LockIcon />} title="Privacy Policy" />
            <Card to="/terms" icon={<DocumentIcon />} title="Terms of Service" />
          </div>
        </section>

        <button className="profile-logout-btn" onClick={handleLogout}>
          <LogoutIcon />
          <span>Log Out</span>
        </button>
      </div>

      {viewingPhoto && user.photo && (
        <div className="profile-photo-viewer" onClick={() => setViewingPhoto(false)}>
          <img src={user.photo} alt="Profile" />
          <button className="profile-photo-viewer-close" onClick={() => setViewingPhoto(false)}>✕</button>
        </div>
      )}
    </div>
  );
};

export default Profile;
