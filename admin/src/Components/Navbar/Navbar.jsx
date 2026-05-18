/**
 * Navbar.jsx — Brutalist Industrial Redesign
 * Sharp. Functional. Unapologetic.
 */

import React, { useState, useEffect, useRef } from "react";
import "./Navbar.css";
import navlogo from "../../assets/logo.png";
import NotificationCenter from "../NotificationCenter/NotificationCenter";
import { useTheme } from "../../Context/ThemeContext";

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

const MonitorIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
    <line x1="8" y1="21" x2="16" y2="21"></line>
    <line x1="12" y1="17" x2="12" y2="21"></line>
  </svg>
);

const Navbar = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [adminName, setAdminName] = useState("Admin");
  const [adminRole, setAdminRole] = useState("");
  const { theme, setTheme } = useTheme();
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const themeDropdownRef = useRef(null);

  useEffect(() => {
    const name = sessionStorage.getItem("admin-name") || "Admin";
    const roles = JSON.parse(sessionStorage.getItem("admin-roles") || "[]");
    setAdminName(name);
    setAdminRole(roles[0] || "");
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(e.target)) setThemeDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("admin-token");
    sessionStorage.removeItem("admin-roles");
    sessionStorage.removeItem("admin-name");
    window.location.href = "/";
  };

  const roleConfig = {
    owner: { label: "Owner", class: "owner" },
    admin: { label: "Admin", class: "admin" },
    staff: { label: "Staff", class: "staff" },
    inventory_staff: { label: "Inventory", class: "inventory_staff" },
  };
  const role = roleConfig[adminRole] || { label: "Staff", class: "staff" };

  const initials = adminName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <nav className="navbar">
      {/* Left: Brand */}
      <div className="nav-left">
        <a href="/admin" className="nav-brand">
          <img src={navlogo} alt="Logo" className="nav-logo" />
          <span className="nav-brand-text">
            GOOD<span className="nav-brand-dot">SOLES</span>
          </span>
        </a>
      </div>

      {/* Right: Actions + User */}
      <div className="nav-right">
        {/* Notification Center */}
        <NotificationCenter />

        {/* Theme Switcher */}
        <div className="nav-theme" ref={themeDropdownRef}>
          <button 
            className="nav-theme-btn" 
            onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
            aria-expanded={themeDropdownOpen}
            title="Appearance"
          >
            {theme === 'light' ? <SunIcon /> : theme === 'dark' ? <MoonIcon /> : <MonitorIcon />}
          </button>
          {themeDropdownOpen && (
            <div className="nav-theme-dropdown">
              <button 
                className={`nav-theme-item ${theme === 'light' ? 'active' : ''}`} 
                onClick={() => { setTheme('light'); setThemeDropdownOpen(false); }}
              >
                <SunIcon /> Light
              </button>
              <button 
                className={`nav-theme-item ${theme === 'dark' ? 'active' : ''}`} 
                onClick={() => { setTheme('dark'); setThemeDropdownOpen(false); }}
              >
                <MoonIcon /> Dark
              </button>
              <button 
                className={`nav-theme-item ${theme === 'system' ? 'active' : ''}`} 
                onClick={() => { setTheme('system'); setThemeDropdownOpen(false); }}
              >
                <MonitorIcon /> System
              </button>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="nav-user" ref={dropdownRef}>
          <button
            className="nav-user-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
          >
            <div className="nav-avatar">{initials}</div>
            <div className="nav-user-info">
              <span className="nav-user-name">{adminName}</span>
              <span className={`nav-role-badge ${role.class}`}>
                {role.label}
              </span>
            </div>
          </button>

          {dropdownOpen && (
            <div className="nav-dropdown">
              <button className="nav-dropdown-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Profile
              </button>
              <button className="nav-dropdown-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings
              </button>
              <div className="nav-dropdown-divider" />
              <button className="nav-dropdown-item logout" onClick={handleLogout}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
