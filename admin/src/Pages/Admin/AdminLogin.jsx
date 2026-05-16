import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "../../services/api";
import "./AdminLogin.css";
import adminLogo from "../../assets/admin_logo.png";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);

  useEffect(() => {
    const token = sessionStorage.getItem("admin-token");
    if (token) {
      navigateRef.current("/dashboard");
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem("admin-token", data.token);
        sessionStorage.setItem("admin-roles", JSON.stringify(data.roles));
        sessionStorage.setItem("admin-name", data.name);
        navigate("/dashboard");
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Server error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      {/* ── Background Elements ── */}
      <div className="admin-login-bg">
        <div className="admin-login-flare" />
        <div className="admin-login-mesh" />
      </div>

      <div className="admin-login-container">
        <div className="admin-login-card iridescent-glass">
          <div className="admin-login-header">
            <h1 className="admin-login-title-chrome">GOODSOLES</h1>
            <p className="admin-login-subtitle-luxe">LUXURY SNEAKERS</p>
            <p className="admin-login-tagline-luxe">COLLECTOR VAULT &bull; ADMIN PORTAL</p>
          </div>

          {error && (
            <div className="admin-login-error">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="admin-login-form">
            <div className="admin-input-group">
              <label className="admin-input-label">Email Address</label>
              <div className="admin-input-wrapper glass-pill">
                <svg className="admin-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="user@example.com"
                  className="admin-input-minimal"
                />
              </div>
            </div>

            <div className="admin-input-group">
              <label className="admin-input-label">Password</label>
              <div className="admin-input-wrapper glass-pill">
                <svg className="admin-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="admin-input-minimal"
                />
                <button
                  type="button"
                  className="admin-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="admin-login-btn-luxe"
            >
              {loading ? (
                <span className="admin-login-spinner" />
              ) : (
                <>
                  SIGN IN
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="admin-login-footer-minimal">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>SECURE ACCESS FOR AUTHORIZED PERSONNEL ONLY</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
