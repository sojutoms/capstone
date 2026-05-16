import React, { useEffect, useState, useRef, useCallback } from "react";
import "./Settings.css";
import API_BASE_URL from "../../services/api";

const passwordRules = [
  { key: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { key: "upper", label: "One uppercase letter (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { key: "number", label: "One number (0-9)", test: (p) => /[0-9]/.test(p) },
  { key: "special", label: "One special character (!@#$...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const EyeIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EyeOffIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.9 21.9 0 0 1 5.06-6.06" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 1l22 22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.88 9.88A3 3 0 0 0 14.12 14.12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ─── OTP boxes for password change verification ─────────────────────────── */
const OtpInput = ({ value, length = 6, onChange, error }) => {
  const inputsRef = useRef([]);

  useEffect(() => {
    inputsRef.current = inputsRef.current.slice(0, length);
  }, [length]);

  const focusInput = (idx) => inputsRef.current[idx]?.focus();

  const handleChange = (e, idx) => {
    const digit = e.target.value.replace(/\D/g, "");
    if (!digit) {
      const a = value.split("");
      a[idx] = "";
      onChange(a.join("").slice(0, length));
      return;
    }
    const char = digit[0];
    const newArr = value.split("");
    newArr[idx] = char;
    digit.slice(1).split("").forEach((c, i) => { if (idx + 1 + i < length) newArr[idx + 1 + i] = c; });
    const newVal = newArr.join("").slice(0, length);
    onChange(newVal);
    let next = idx + 1;
    while (next < length && newVal[next]) next++;
    if (next < length) focusInput(next);
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const a = value.split("");
      if (a[idx]) { a[idx] = ""; onChange(a.join("").slice(0, length)); focusInput(idx); }
      else if (idx > 0) { a[idx - 1] = ""; onChange(a.join("").slice(0, length)); focusInput(idx - 1); }
    } else if (e.key === "ArrowLeft" && idx > 0) { e.preventDefault(); focusInput(idx - 1); }
    else if (e.key === "ArrowRight" && idx < length - 1) { e.preventDefault(); focusInput(idx + 1); }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "").slice(0, length);
    if (!paste) return;
    const newArr = Array.from({ length }, (_, i) => paste[i] || value[i] || "");
    onChange(newArr.join("").slice(0, length));
    const first = newArr.findIndex((d) => !d);
    focusInput(first === -1 ? length - 1 : first);
  };

  const digits = value.split("").slice(0, length);

  return (
    <div className="settings-otp-wrapper">
      <div className="settings-otp-boxes" onPaste={handlePaste}>
        {Array.from({ length }).map((_, idx) => (
          <input
            key={idx}
            ref={(el) => (inputsRef.current[idx] = el)}
            className={[
              "settings-otp-box",
              digits[idx] ? "settings-otp-box--filled" : "",
              error ? "settings-otp-box--error" : "",
            ].filter(Boolean).join(" ")}
            inputMode="numeric"
            pattern="\d{1}"
            maxLength={1}
            value={digits[idx] || ""}
            onChange={(e) => handleChange(e, idx)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            onFocus={(e) => e.target.select()}
            aria-label={`OTP digit ${idx + 1}`}
          />
        ))}
      </div>
      {error && <p className="field-error" style={{ textAlign: "center", marginTop: 6 }}>{error}</p>}
    </div>
  );
};

/* ─── Main Component ─────────────────────────────────────────────────────── */
const Settings = () => {
  const [activeTab, setActiveTab] = useState("profile");

  /* ── Profile state ── */
  const [profile, setProfile] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [originalProfile, setOriginalProfile] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [editing, setEditing] = useState(false);

  /* ── Password state ── */
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  const [pwdErrors, setPwdErrors] = useState({});
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);

  /* ── Password-change OTP flow ── */
  // Steps: "form" → "otp" → done
  const [pwdStep, setPwdStep] = useState("form"); // "form" | "otp"
  const [pwdOtp, setPwdOtp] = useState("");
  const [pwdOtpError, setPwdOtpError] = useState("");
  const [pwdOtpSending, setPwdOtpSending] = useState(false);
  // store validated passwords while waiting for OTP
  const pendingPwdRef = useRef({ current: "", newPass: "" });

  /* ── Shared ── */
  const [message, setMessage] = useState(null);
  const closeMsgRef = useRef(null);

  /* ── Delete modal ── */
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const showMessage = useCallback((type, text) => {
    setMessage({ type, text });
    if (closeMsgRef.current) clearTimeout(closeMsgRef.current);
    closeMsgRef.current = setTimeout(() => setMessage(null), 3500);
  }, []);

  /* ── Fetch profile ── */
  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem("auth-token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/user/profile`, { headers: { "auth-token": token } });
      const data = await res.json();
      if (data.success) {
        const user = data.user || {};
        let firstName = user.firstName || "";
        let lastName = user.lastName || "";
        if (!firstName && user.name) {
          const parts = user.name.trim().split(" ");
          firstName = parts[0] || "";
          lastName = parts.slice(1).join(" ") || "";
        }
        const prof = { firstName, lastName, email: user.email || "", phone: user.phone || "" };
        setProfile(prof);
        setOriginalProfile(prof);
      }
    } catch {
      showMessage("error", "Sync Error");
    }
  }, [showMessage]);

  useEffect(() => {
    fetchProfile();
    return () => { if (closeMsgRef.current) clearTimeout(closeMsgRef.current); };
  }, [fetchProfile]);

  /* ── Profile helpers ── */
  const handleCancel = () => { setProfile(originalProfile); setEditing(false); };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("auth-token");
    try {
      const res = await fetch(`${API_BASE_URL}/user/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "auth-token": token },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (data.success) { setOriginalProfile(profile); setEditing(false); showMessage("success", "Profile Updated"); }
      else showMessage("error", data.message || "Update Failed");
    } catch {
      showMessage("error", "Update Failed");
    }
  };

  /* ── Password helpers ── */
  const getPwdChecks = (pwd) => passwordRules.map((r) => ({ ...r, passed: r.test(pwd) }));
  const pwdChecks = getPwdChecks(passwords.newPass);

  const blockClipboard = (e) => e.preventDefault();

  /* Step 1: validate fields, request OTP to be sent to user's email */
  const handleRequestPwdOtp = async (e) => {
    e.preventDefault();
    const errs = {};

    if (!passwords.current) errs.current = "Current password is required.";
    const checks = getPwdChecks(passwords.newPass);
    if (checks.some((c) => !c.passed)) errs.newPass = "Password does not meet all requirements.";
    if (!passwords.newPass) errs.newPass = "New password is required.";
    if (passwords.newPass !== passwords.confirm) errs.confirm = "Passwords do not match.";
    if (!passwords.confirm) errs.confirm = "Please confirm your new password.";

    if (Object.keys(errs).length > 0) { setPwdErrors(errs); return; }
    setPwdErrors({});
    setPwdOtpSending(true);

    const token = localStorage.getItem("auth-token");
    try {
      // First verify the current password is correct before sending OTP
      const verifyRes = await fetch(`${API_BASE_URL}/user/verify-current-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-token": token },
        body: JSON.stringify({ currentPassword: passwords.current }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        setPwdErrors({ current: verifyData.message || "Incorrect current password." });
        setPwdOtpSending(false);
        return;
      }

      // Current password is correct — send OTP to email
      const otpRes = await fetch(`${API_BASE_URL}/user/send-change-password-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "auth-token": token },
      });
      const otpData = await otpRes.json();
      if (otpData.success) {
        pendingPwdRef.current = { current: passwords.current, newPass: passwords.newPass };
        setPwdStep("otp");
        setPwdOtp("");
        setPwdOtpError("");
        showMessage("success", "OTP sent to your email");
      } else {
        showMessage("error", otpData.message || "Failed to send OTP");
      }
    } catch {
      showMessage("error", "Request failed. Please try again.");
    } finally {
      setPwdOtpSending(false);
    }
  };

  /* Step 2: verify OTP then change password */
  const handleVerifyPwdOtp = async () => {
    setPwdOtpError("");
    if (!/^\d{6}$/.test(pwdOtp)) { setPwdOtpError("Enter all 6 digits."); return; }

    const token = localStorage.getItem("auth-token");
    try {
      const res = await fetch(`${API_BASE_URL}/user/changepassword`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "auth-token": token },
        body: JSON.stringify({
          currentPassword: pendingPwdRef.current.current,
          newPassword: pendingPwdRef.current.newPass,
          otp: pwdOtp,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPasswords({ current: "", newPass: "", confirm: "" });
        setShowNewPwd(false);
        setShowConfirmPwd(false);
        setShowCurrentPwd(false);
        setPwdStep("form");
        setPwdOtp("");
        showMessage("success", "Password Updated");
      } else {
        setPwdOtpError(data.message || "Invalid OTP. Please try again.");
      }
    } catch {
      setPwdOtpError("Verification failed. Please try again.");
    }
  };

  const handleCancelOtp = () => {
    setPwdStep("form");
    setPwdOtp("");
    setPwdOtpError("");
  };

  /* ── Name input sanitizer ── */
  const sanitizeName = (v) => v.replace(/[^A-Za-z\s]/g, "");
  const handleFirstNameChange = (e) => setProfile((p) => ({ ...p, firstName: sanitizeName(e.target.value) }));
  const handleLastNameChange = (e) => setProfile((p) => ({ ...p, lastName: sanitizeName(e.target.value) }));
  const handleNamePaste = (e, setter) => {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData("text") || "";
    const name = e.target.name;
    setter((p) => ({ ...p, [name]: sanitizeName(paste) }));
  };

  /* ── Delete account ── */
  const deleteAccount = async () => {
    setDeleting(true);
    const token = localStorage.getItem("auth-token");
    try {
      const res = await fetch(`${API_BASE_URL}/user`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "auth-token": token },
      });
      const data = await res.json();
      if (data.success) { localStorage.removeItem("auth-token"); window.location.replace("/"); }
      else showMessage("error", data.message || "Failed to delete account");
    } catch {
      showMessage("error", "Delete request failed");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="settings-container">
      <div className="settings-glass-panel">

        {/* SIDEBAR */}
        <aside className="settings-sidebar">
          <div className="sidebar-brand">
            <div className="brand-dot" />
            <span>System Console</span>
          </div>
          <nav className="sidebar-nav">
            <button className={activeTab === "profile" ? "active" : ""} onClick={() => { setActiveTab("profile"); handleCancel(); }}>User Profile</button>
            <button className={activeTab === "security" ? "active" : ""} onClick={() => { setActiveTab("security"); handleCancel(); setPwdStep("form"); }}>Security</button>
            <button className={activeTab === "danger" ? "active" : ""} onClick={() => { setActiveTab("danger"); handleCancel(); }}>Advanced</button>
          </nav>
          <div style={{ marginTop: 24 }}>
            <button className="logout-trigger" onClick={() => { localStorage.removeItem("auth-token"); window.location.replace("/"); }}>
              Logout Session
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <main className="settings-main">
          {message && <div className={`floating-alert ${message.type}`}>{message.text}</div>}

          {/* ── PROFILE TAB ── */}
          {activeTab === "profile" && (
            <div className="content-fade-in">
              <header className="section-header">
                <h2>Account Details</h2>
                {!editing
                  ? <button className="edit-toggle" onClick={() => setEditing(true)}>Edit Profile</button>
                  : <button className="edit-toggle cancel-btn" onClick={handleCancel}>Cancel</button>
                }
              </header>

              <form className="innovative-form" onSubmit={handleUpdate}>
                {/* Name row */}
                <div className="row-flex" style={{ display: "flex", gap: 20 }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>First Name</label>
                    <input
                      name="firstName"
                      className={editing ? "editing" : ""}
                      disabled={!editing}
                      value={profile.firstName}
                      onChange={handleFirstNameChange}
                      onPaste={(e) => handleNamePaste(e, setProfile)}
                      placeholder="FIRST NAME"
                      required
                    />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Last Name</label>
                    <input
                      name="lastName"
                      className={editing ? "editing" : ""}
                      disabled={!editing}
                      value={profile.lastName}
                      onChange={handleLastNameChange}
                      onPaste={(e) => handleNamePaste(e, setProfile)}
                      placeholder="LAST NAME"
                      required
                    />
                  </div>
                </div>

                {/* Email — always locked/read-only */}
                <div className="input-group">
                  <label>
                    Contact Email
                    <span className="field-locked-badge"></span>
                  </label>
                  <input
                    value={profile.email}
                    disabled
                    readOnly
                    placeholder="EMAIL ADDRESS"
                    title="Email cannot be changed"
                  />
                </div>

                {/* Phone number */}
                <div className="input-group">
                  <label>Phone Number</label>
                  <input
                    name="phone"
                    className={editing ? "editing" : ""}
                    disabled={!editing}
                    value={profile.phone}
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="09XXXXXXXXX"
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                      setProfile((p) => ({ ...p, phone: v }));
                    }}
                  />
                  {editing && profile.phone && !/^\d{11}$/.test(profile.phone) && (
                    <span className="field-error">Phone number must be exactly 11 digits.</span>
                  )}
                </div>

                {editing && (
                  <button
                    type="submit"
                    className="save-btn"
                    disabled={!!(profile.phone && !/^\d{11}$/.test(profile.phone))}
                  >
                    Submit
                  </button>
                )}
              </form>
            </div>
          )}

          {/* ── SECURITY TAB ── */}
          {activeTab === "security" && (
            <div className="content-fade-in">
              <header className="section-header">
                <h2>Password Settings</h2>
              </header>

              {/* ── Step 1: password form ── */}
              {pwdStep === "form" && (
                <form className="innovative-form" onSubmit={handleRequestPwdOtp}>
                  {/* Current Password */}
                  <div className="input-group">
                    <label>Current Password</label>
                    <div className="pwd-input-wrapper">
                      <input
                        type={showCurrentPwd ? "text" : "password"}
                        placeholder="••••••••"
                        value={passwords.current}
                        onChange={(e) => { setPasswords({ ...passwords, current: e.target.value }); setPwdErrors((p) => ({ ...p, current: "" })); }}
                        onCopy={blockClipboard} onPaste={blockClipboard} onCut={blockClipboard} onContextMenu={blockClipboard}
                        style={{ flex: 1 }}
                        aria-label="Current password"
                      />
                      <button type="button" className="pwd-toggle" onClick={() => setShowCurrentPwd((s) => !s)} aria-label={showCurrentPwd ? "Hide" : "Show"}>
                        {showCurrentPwd ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    {pwdErrors.current && <span className="field-error">{pwdErrors.current}</span>}
                  </div>

                  {/* New Password */}
                  <div className="input-group">
                    <label>New Password</label>
                    <div className="pwd-input-wrapper">
                      <input
                        type={showNewPwd ? "text" : "password"}
                        placeholder="••••••••"
                        value={passwords.newPass}
                        onChange={(e) => { setPasswords({ ...passwords, newPass: e.target.value }); setPwdErrors((p) => ({ ...p, newPass: "" })); }}
                        onCopy={blockClipboard} onPaste={blockClipboard} onCut={blockClipboard} onContextMenu={blockClipboard}
                        style={{ flex: 1 }}
                        aria-label="New password"
                      />
                      <button type="button" className="pwd-toggle" onClick={() => setShowNewPwd((s) => !s)} aria-label={showNewPwd ? "Hide" : "Show"}>
                        {showNewPwd ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    {pwdErrors.newPass && <span className="field-error">{pwdErrors.newPass}</span>}
                    {passwords.newPass.length > 0 && (
                      <ul className="pwd-checklist">
                        {pwdChecks.map((c) => (
                          <li key={c.key} className={c.passed ? "check-pass" : "check-fail"}>
                            <span className="check-icon">{c.passed ? "✓" : "✗"}</span>
                            {c.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="input-group">
                    <label>Confirm New Password</label>
                    <div className="pwd-input-wrapper">
                      <input
                        type={showConfirmPwd ? "text" : "password"}
                        placeholder="••••••••"
                        value={passwords.confirm}
                        onChange={(e) => { setPasswords({ ...passwords, confirm: e.target.value }); setPwdErrors((p) => ({ ...p, confirm: "" })); }}
                        onCopy={blockClipboard} onPaste={blockClipboard} onCut={blockClipboard} onContextMenu={blockClipboard}
                        style={{ flex: 1 }}
                        aria-label="Confirm new password"
                      />
                      <button type="button" className="pwd-toggle" onClick={() => setShowConfirmPwd((s) => !s)} aria-label={showConfirmPwd ? "Hide" : "Show"}>
                        {showConfirmPwd ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    {pwdErrors.confirm && <span className="field-error">{pwdErrors.confirm}</span>}
                  </div>

                  <button className="save-btn" type="submit" disabled={pwdOtpSending}>
                    {pwdOtpSending ? "Sending OTP…" : "Continue"}
                  </button>
                </form>
              )}

              {/* ── Step 2: OTP verification ── */}
              {pwdStep === "otp" && (
                <div className="innovative-form">
                  <div className="otp-verify-block">
                    <p className="otp-verify-hint">
                      A 6-digit verification code was sent to <strong>{profile.email}</strong>.
                      Enter it below to confirm the password change.
                    </p>
                    <OtpInput value={pwdOtp} onChange={setPwdOtp} error={pwdOtpError} />
                    <div className="otp-verify-actions">
                      <button className="save-btn" onClick={handleVerifyPwdOtp}>Verify &amp; Update Password</button>
                      <button className="edit-toggle cancel-btn" onClick={handleCancelOtp} style={{ marginTop: 10 }}>
                        ← Back
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DANGER TAB ── */}
          {activeTab === "danger" && (
            <div className="content-fade-in">
              <header className="section-header">
                <h2>Account Option</h2>
              </header>
              <div className="danger-zone">
                <p>DELETING ACCOUNT DATA WILL REMOVE ALL TRANSACTION LOGS AND SAVED PREFERENCES PERMANENTLY.</p>
                <button className="destroy-btn" onClick={() => setShowDeleteModal(true)}>Delete Account Data</button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="modal-card">
            <h3 id="delete-modal-title">Confirm Account Deletion</h3>
            <p className="modal-body">This action will permanently delete your account and all associated data. This cannot be undone. Are you sure you want to proceed?</p>
            <div className="modal-actions">
              <button className="modal-btn modal-cancel" onClick={() => setShowDeleteModal(false)} disabled={deleting}>Cancel</button>
              <button className="modal-btn modal-danger" onClick={deleteAccount} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
