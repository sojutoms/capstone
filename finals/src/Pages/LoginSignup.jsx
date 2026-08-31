import React, { useState, useRef, useEffect, useCallback } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./CSS/LoginSignup.css";
import API_BASE_URL from "../services/api";

/* ─── Password rules ─────────────────────────────────────────────────────────── */
const passwordRules = [
  { key: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { key: "upper", label: "One uppercase letter (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { key: "number", label: "One number (0-9)", test: (p) => /[0-9]/.test(p) },
  { key: "special", label: "One special character (!@#$...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

/* ─── Terms & Privacy content ────────────────────────────────────────────────── */
const TERMS_CONTENT = {
  terms: {
    title: "Terms of Use",
    sections: [
      { heading: "1. Acceptance of Terms", body: "By accessing and using GoodSoles PH, you accept and agree to be bound by the terms and provision of this agreement. In addition, when using GoodSoles PH's particular services, you shall be subject to any posted guidelines or rules applicable to such services." },
      { heading: "2. Description of Service", body: "GoodSoles PH provides users with access to an online marketplace for authentic sneakers and streetwear products. You understand and agree that the service is provided 'as-is' and that GoodSoles PH assumes no responsibility for the timeliness, deletion, mis-delivery, or failure to store any user communications or personalization settings." },
      { heading: "3. Registration & Account", body: "To access certain features of the service, you will need to register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete. GoodSoles PH reserves the right to suspend or terminate your account if any information provided proves inaccurate, not current, or incomplete." },
      { heading: "4. User Conduct", body: "You agree not to use the service to: (a) upload, post, or transmit any content that is unlawful, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable; (b) impersonate any person or entity; (c) forge or manipulate identifiers to disguise the origin of any content; (d) upload or transmit any material that infringes any patent, trademark, copyright, or other proprietary rights." },
      { heading: "5. Product Authenticity", body: "GoodSoles PH is committed to selling only 100% authentic products. Every item undergoes a rigorous verification process before being listed or shipped. Any item found to be inauthentic will be immediately removed, and the seller will be permanently banned from the platform." },
      { heading: "6. Payments & Pricing", body: "All prices displayed are in Philippine Pesos (PHP) unless otherwise stated. GoodSoles PH reserves the right to modify pricing at any time. Transactions are processed through secure payment gateways. You agree to pay all charges incurred by you or any users of your account at the price(s) in effect when such charges are incurred." },
      { heading: "7. Shipping & Delivery", body: "GoodSoles PH ships nationwide across the Philippines. Delivery times are estimates and are not guaranteed. GoodSoles PH shall not be liable for delays caused by the shipping carrier, natural disasters, or other circumstances beyond our reasonable control." },
      { heading: "8. Returns & Refunds", body: "Returns are accepted within 7 days of receipt for items that are defective or not as described. Items must be returned in their original, unworn condition with all original packaging and tags. Refunds will be processed within 5–10 business days after we receive and inspect the returned item." },
      { heading: "9. Limitation of Liability", body: "GoodSoles PH shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of (or inability to access or use) the service." },
      { heading: "10. Changes to Terms", body: "GoodSoles PH reserves the right to modify these terms at any time. We will provide notice of significant changes by updating the date at the top of this page. Your continued use of the service after such modifications constitutes your acceptance of the revised terms." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      { heading: "1. Information We Collect", body: "We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support. This includes your name, email address, phone number, shipping address, and payment information." },
      { heading: "2. How We Use Your Information", body: "We use the information we collect to process transactions, send transactional and promotional communications, provide customer support, and improve our services. We may also use your information to personalize your experience and send you relevant product recommendations." },
      { heading: "3. Information Sharing", body: "We do not sell, trade, or otherwise transfer your personally identifiable information to third parties without your consent, except to trusted third parties who assist us in operating our website, conducting our business, or servicing you, so long as those parties agree to keep this information confidential." },
      { heading: "4. Data Security", body: "We implement a variety of security measures to maintain the safety of your personal information. Your personal information is contained behind secured networks and is only accessible by a limited number of persons who have special access rights to such systems." },
      { heading: "5. Cookies", body: "GoodSoles PH uses cookies to enhance your experience, gather general visitor information, and track visits to our website. You can choose to have your computer warn you each time a cookie is being sent, or you can choose to turn off all cookies via your browser settings." },
      { heading: "6. Third-Party Links", body: "Occasionally, at our discretion, we may include or offer third-party products or services on our website. These third-party sites have separate and independent privacy policies. We have no responsibility or liability for the content and activities of these linked sites." },
      { heading: "7. Children's Privacy", body: "Our service is not directed to individuals under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we will take steps to delete such information." },
      { heading: "8. Your Rights", body: "You have the right to access, correct, or delete your personal information at any time. You may also object to or restrict the processing of your personal information. To exercise these rights, please contact us at privacy@goodsolesph.com." },
      { heading: "9. Data Retention", body: "We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When we no longer need your information, we will securely delete or anonymize it." },
      { heading: "10. Contact Us", body: "If you have any questions about this Privacy Policy or our data practices, please contact us at privacy@goodsolesph.com or write to us at GoodSoles PH, Manila, Philippines. We will respond to your inquiry within 30 days." },
    ],
  },
};

/* ─── Legal Modal ────────────────────────────────────────────────────────────── */
const LegalModal = ({ type, onClose, onAgree, agreed }) => {
  const content = TERMS_CONTENT[type];
  const scrollRef = useRef(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [internalChecked, setInternalChecked] = useState(agreed);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10;
    if (atBottom) setScrolledToBottom(true);
  }, []);

  useEffect(() => { setScrolledToBottom(false); setInternalChecked(agreed); }, [type, agreed]);
  useEffect(() => { if (scrolledToBottom) setInternalChecked(true); }, [scrolledToBottom]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleConfirm = () => {
    if (internalChecked) { onAgree(true); onClose(); }
  };

  return (
    <div className="ls-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ls-modal-card" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title">
        <div className="ls-modal-header">
          <h2 id="legal-modal-title" className="ls-modal-title">{content.title}</h2>
          <button className="ls-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {!scrolledToBottom && (
          <div className="ls-modal-scroll-hint">
            <span>↓ Scroll to the bottom to unlock agreement</span>
          </div>
        )}
        <div className="ls-modal-body" ref={scrollRef} onScroll={handleScroll}>
          {content.sections.map((s) => (
            <div key={s.heading} className="ls-modal-section">
              <h3 className="ls-modal-section-heading">{s.heading}</h3>
              <p className="ls-modal-section-body">{s.body}</p>
            </div>
          ))}
          <div className="ls-modal-sentinel" />
        </div>
        <div className="ls-modal-footer">
          <label className={`ls-modal-agree-row${!scrolledToBottom ? " ls-modal-agree-row--locked" : ""}`}>
            <input
              type="checkbox"
              className="ls-modal-checkbox"
              checked={internalChecked}
              disabled={!scrolledToBottom}
              onChange={(e) => setInternalChecked(e.target.checked)}
            />
            <span className="ls-modal-agree-label">
              {scrolledToBottom
                ? `I have read and agree to the ${content.title}`
                : "Read to the bottom to enable this checkbox"}
            </span>
          </label>
          <button
            className={`ls-modal-confirm-btn${!internalChecked ? " ls-modal-confirm-btn--disabled" : ""}`}
            onClick={handleConfirm}
            disabled={!internalChecked}
          >
            {internalChecked ? "Confirm & Close" : "Scroll to continue ↓"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── MultiOtpInput ─────────────────────────────────────────────────────────── */
const MultiOtpInput = ({ value, length = 6, onChange, error }) => {
  const inputsRef = useRef([]);
  const digits = value.split("").slice(0, length);

  useEffect(() => { inputsRef.current = inputsRef.current.slice(0, length); }, [length]);

  const focusInput = (idx) => inputsRef.current[idx]?.focus();

  const handleChange = (e, idx) => {
    const digit = e.target.value.replace(/\D/g, "");
    if (!digit) { const a = value.split(""); a[idx] = ""; onChange(a.join("").slice(0, length)); return; }
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

  return (
    <div className="ls-otp-wrapper">
      <div className="ls-otp-boxes" onPaste={handlePaste}>
        {Array.from({ length }).map((_, idx) => (
          <input key={idx} ref={(el) => (inputsRef.current[idx] = el)}
            className={["ls-otp-box", digits[idx] ? "ls-otp-box--filled" : "", error ? "ls-otp-box--error" : ""].filter(Boolean).join(" ")}
            inputMode="numeric" pattern="\d{1}" maxLength={1} value={digits[idx] || ""}
            onChange={(e) => handleChange(e, idx)} onKeyDown={(e) => handleKeyDown(e, idx)}
            onFocus={(e) => e.target.select()} aria-label={`OTP digit ${idx + 1}`}
          />
        ))}
      </div>
      {error && <p className="ls-error ls-error--center">{error}</p>}
    </div>
  );
};

/* ─── ResendOtpButton ────────────────────────────────────────────────────────── */
// Cooldown schedule:
//   resendAttempts = 0 (button shown for first time) → initial cooldown = 60s
//   resendAttempts = 1 (after first resend)          → next cooldown = 120s
//   resendAttempts >= 2 (after second+ resend)       → next cooldown = 180s
const ResendOtpButton = ({ email, type, onResendSuccess, initialCooldownSeconds = 60 }) => {
  const [countdown, setCountdown] = useState(initialCooldownSeconds);
  const [resendAttempts, setResendAttempts] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const timerRef = useRef(null);

  // Start countdown on mount and whenever countdown is set to a positive value
  useEffect(() => {
    if (countdown <= 0) return;
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [countdown]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
  };

  const handleResend = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success("New OTP sent to your email!");
        const newAttempts = resendAttempts + 1;
        setResendAttempts(newAttempts);

        // Determine next cooldown based on updated attempt count
        // newAttempts=1 → we just did 1st resend → next cooldown is 120s
        // newAttempts>=2 → we just did 2nd+ resend → next cooldown is 180s
        const nextCooldown = data.nextCooldownSeconds ||
          (newAttempts === 1 ? 120 : 180);
        setCountdown(nextCooldown);

        if (onResendSuccess) onResendSuccess();
      } else {
        // Server returned 429 or other error — sync countdown with server's remaining time
        const serverRemaining = data.remainingSeconds;
        if (serverRemaining && serverRemaining > 0) {
          setCountdown(serverRemaining);
        }
        toast.error(data.errors || "Failed to resend OTP. Please try again.");
      }
    } catch {
      toast.error("Network error. Please check your connection.");
    } finally {
      setIsResending(false);
    }
  };

  const canResend = countdown === 0 && !isResending;

  return (
    <div className="ls-resend-row">
      <span className="ls-resend-label">Didn't receive the code?</span>
      {canResend ? (
        <button
          type="button"
          className="ls-link-btn ls-resend-btn"
          onClick={handleResend}
        >
          Resend OTP
        </button>
      ) : (
        <span className="ls-resend-countdown">
          {isResending ? (
            <span className="ls-resend-sending">Sending…</span>
          ) : (
            <>Resend in <strong className="countdown">{formatTime(countdown)}</strong></>
          )}
        </span>
      )}
    </div>
  );
};

/* ─── Password strength ─────────────────────────────────────────────────────── */
const getPasswordStrength = (pw) => {
  if (!pw) return "";
  let s = 0;
  if (pw.length >= 6) s++; if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw)) s++; if (/[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 2) return "Weak"; if (s <= 4) return "Medium"; return "Strong";
};

/* ─── Brand Panel ────────────────────────────────────────────────────────────── */
const BrandPanel = () => (
  <div className="ls-brand-inner">
    <div className="ls-brand-top">
      <div className="ls-brand-logo-wrap">
        <div className="ls-brand-logo-box">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <text x="14" y="22" textAnchor="middle" fontFamily="'Barlow Condensed', sans-serif" fontWeight="900" fontSize="24" fill="var(--bg-primary)" letterSpacing="-1">GS</text>
          </svg>
        </div>
        <div className="ls-brand-logo-name">
          <span className="ls-brand-title">GoodSoles</span>
          <span className="ls-brand-subtitle">PH — Est. 2024</span>
        </div>
      </div>
      <div className="ls-brand-headline">
        <span className="ls-brand-headline-line">STEP</span>
        <span className="ls-brand-headline-line ls-brand-headline-line--accent">INTO</span>
        <span className="ls-brand-headline-line ls-brand-headline-line--outline">CULTURE</span>
        <p className="ls-brand-tagline">Authentic sneakers &amp; streetwear — Philippines</p>
      </div>
    </div>
    <div className="ls-brand-bottom">
      {["100% Authentic, always", "Nationwide shipping", "Secure &amp; trusted checkout"].map((f) => (
        <div key={f} className="ls-brand-feature">
          <span className="ls-brand-feature-dot" />
          <span dangerouslySetInnerHTML={{ __html: f }} />
        </div>
      ))}
    </div>
  </div>
);

/* ─── Field wrapper ──────────────────────────────────────────────────────────── */
const Field = ({ error, children }) => (
  <div className="ls-field">
    <div className="ls-field-inner">
      {React.cloneElement(children, {
        className: ["ls-input", error ? "ls-input--error" : "", children.props.className || ""].filter(Boolean).join(" "),
      })}
    </div>
    {error && <p className="ls-error">{error}</p>}
  </div>
);

/* ─── Eye icons ──────────────────────────────────────────────────────────────── */
const EyeIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
const EyeOffIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.9 21.9 0 0 1 5.06-6.06" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 1l22 22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.88 9.88A3 3 0 0 0 14.12 14.12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ─── Main Component ─────────────────────────────────────────────────────────── */
const LoginSignup = () => {
  const [mode, setMode] = useState("login");
  const [animating, setAnimating] = useState(false);
  const [brandLeft, setBrandLeft] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "", newPassword: "",
  });

  const [agreed, setAgreed] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const bothAgreed = termsAgreed && privacyAgreed;

  const [legalModal, setLegalModal] = useState(null);

  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState({});
  const [pwStrength, setPwStrength] = useState("");

  // Tracks the initial cooldown seconds to pass into ResendOtpButton when OTP is first sent.
  // After the first send it's always 60s. After each resend the component manages its own state.
  const [resendKey, setResendKey] = useState(0); // bump to remount ResendOtpButton on new OTP flow

  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showSignupPwd, setShowSignupPwd] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);
  const [showResetNewPwd, setShowResetNewPwd] = useState(false);
  const [showResetConfirmPwd, setShowResetConfirmPwd] = useState(false);

  const MAX_NAME = 64;

  useEffect(() => {
    setAgreed(bothAgreed);
    if (bothAgreed) setErrors((p) => ({ ...p, agreed: "" }));
  }, [bothAgreed]);

  const change = (e) => {
    const { name, value } = e.target;
    setErrors((p) => ({ ...p, [name]: "" }));
    setFormData((p) => ({ ...p, [name]: value }));
    if (name === "password" && mode === "signup") setPwStrength(getPasswordStrength(value));
    if (name === "newPassword") setPwStrength(getPasswordStrength(value));
  };

  const setErr = (field, msg) => setErrors((p) => ({ ...p, [field]: msg }));
  const clearErrors = () => setErrors({});

  const api = async (path, body) => {
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      return await res.json();
    } catch { return { success: false, errors: "Network error" }; }
  };

  const switchMode = (next) => {
    const toSignup = next === "signup";
    const fromSignup = mode === "signup";
    if ((toSignup && !brandLeft) || (!toSignup && fromSignup && brandLeft)) {
      setAnimating(true);
      setTimeout(() => { setBrandLeft(toSignup); setMode(next); setAnimating(false); }, 500);
    } else { setMode(next); }
    setFormData({ firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "", newPassword: "" });
    setOtpSent(false); setOtp(""); clearErrors();
    setPwStrength("");
    setResendKey((k) => k + 1); // reset resend button
  };

  /* ── Handlers ── */
  const login = async () => {
    clearErrors();
    const email = (formData.email || "").trim();
    const password = formData.password || "";
    let bad = false;
    if (!email) { setErr("email", "Email is required."); bad = true; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("email", "Enter a valid email."); bad = true; }
    if (!password) { setErr("password", "Password is required."); bad = true; }
    if (bad) return;
    const data = await api("/login", { email, password });
    if (data.success) { localStorage.setItem("auth-token", data.token); window.location.replace("/"); return; }
    const msg = String(data.errors || "").trim(), lower = msg.toLowerCase();
    if (lower.includes("invalid") || lower.includes("credentials")) { setErr("email", msg || "Invalid credentials."); setErr("password", msg || "Invalid credentials."); }
    else if (lower.includes("password")) { setErr("password", msg || "Wrong password."); }
    else { setErr("email", msg || "Login failed."); setErr("password", msg || "Login failed."); }
  };

  const sendOtp = async () => {
    clearErrors();
    const firstName = (formData.firstName || "").trim(), lastName = (formData.lastName || "").trim();
    const email = (formData.email || "").trim(), phone = (formData.phone || "").trim();
    const password = formData.password || "", confirmPassword = formData.confirmPassword || "";

    if (!agreed) { setErr("agreed", "You must read and agree to both documents to continue."); return; }
    let bad = false;
    if (!firstName) { setErr("firstName", "First name required."); bad = true; }
    else if (/\d/.test(firstName)) { setErr("firstName", "No numbers allowed."); bad = true; }
    else if (firstName.length < 2) { setErr("firstName", "At least 2 characters."); bad = true; }
    if (!lastName) { setErr("lastName", "Last name required."); bad = true; }
    else if (/\d/.test(lastName)) { setErr("lastName", "No numbers allowed."); bad = true; }
    else if (lastName.length < 2) { setErr("lastName", "At least 2 characters."); bad = true; }
    if (!email) { setErr("email", "Email is required."); bad = true; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("email", "Enter a valid email."); bad = true; }
    if (!phone) { setErr("phone", "Phone number is required."); bad = true; }
    else if (!/^\d{11}$/.test(phone)) { setErr("phone", "Phone number must be exactly 11 digits."); bad = true; }
    if (!password) { setErr("password", "Password is required."); bad = true; }
    else { const checks = getPwdChecks(password); if (checks.some((c) => !c.passed)) { setErr("password", "Password does not meet all requirements."); bad = true; } }
    if (!confirmPassword) { setErr("confirmPassword", "Confirm your password."); bad = true; }
    else if (password !== confirmPassword) { setErr("confirmPassword", "Passwords don't match."); bad = true; }
    if (bad) return;
    const data = await api("/signup", { firstName, lastName, email, phone, password });
    if (data.success) {
      setOtpSent(true);
      setResendKey((k) => k + 1); // mount fresh ResendOtpButton
      toast.success("OTP sent to your email!");
    } else {
      if (data.field) setErr(data.field, data.errors); else toast.error(data.errors || "Failed to send OTP");
    }
  };

  const verifyOtp = async () => {
    clearErrors();
    if (!/^\d{6}$/.test(otp)) { setErr("otp", "Enter all 6 digits."); return; }
    const data = await api("/verify-otp", { email: formData.email.trim(), otp });
    if (data.success) { localStorage.setItem("auth-token", data.token); window.location.replace("/"); }
    else setErr("otp", data.errors || "OTP verification failed");
  };

  const forgotPassword = async () => {
    clearErrors();
    const email = (formData.email || "").trim();
    if (!email) { setErr("email", "Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("email", "Enter a valid email."); return; }
    const data = await api("/forgot-password", { email });
    if (data.success) {
      setOtpSent(true);
      setResendKey((k) => k + 1); // mount fresh ResendOtpButton
      toast.success("Reset OTP sent!");
      setMode("reset");
    } else {
      toast.error(data.errors || "Failed to send reset OTP");
    }
  };

  const resetPassword = async () => {
    clearErrors();
    if (!/^\d{6}$/.test(otp)) { setErr("otp", "Enter all 6 digits."); return; }
    const newPassword = formData.newPassword || "", confirmPassword = formData.confirmPassword || "";
    if (!newPassword) { setErr("newPassword", "New password required."); return; }
    const checks = getPwdChecks(newPassword);
    if (checks.some((c) => !c.passed)) { setErr("newPassword", "Password does not meet all requirements."); return; }
    if (!confirmPassword) { setErr("confirmPassword", "Confirm your password."); return; }
    if (newPassword !== confirmPassword) { setErr("confirmPassword", "Passwords don't match."); return; }
    const data = await api("/reset-password", { email: formData.email.trim(), otp, newPassword });
    if (data.success) {
      toast.success("Password reset! Please log in.");
      switchMode("login");
      setFormData({ firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "", newPassword: "" });
    } else {
      toast.error(data.errors || "Reset failed");
    }
  };

  /* ── Enter key handlers ── */
  const handleLoginKey = (e) => { if (e.key === "Enter") login(); };
  const handleSignupKey = (e) => { if (e.key === "Enter") { if (!otpSent) sendOtp(); else verifyOtp(); } };
  const handleForgotKey = (e) => { if (e.key === "Enter") forgotPassword(); };
  const handleResetKey = (e) => { if (e.key === "Enter") resetPassword(); };

  /* ── Checklist helpers ── */
  const getPwdChecks = (pwd) => passwordRules.map((r) => ({ ...r, passed: r.test(pwd) }));
  const signupPwdChecks = getPwdChecks(formData.password || "");
  const resetPwdChecks = getPwdChecks(formData.newPassword || "");

  /* ── Clipboard blockers ── */
  const blockClipboard = (e) => e.preventDefault();
  const blockClipboardKey = (e) => {
    const key = (e.key || "").toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (key === "c" || key === "v" || key === "x" || key === "a")) { e.preventDefault(); e.stopPropagation(); }
    if ((e.shiftKey && key === "insert") || (ctrl && key === "insert")) { e.preventDefault(); e.stopPropagation(); }
  };
  const blockSelect = (e) => e.preventDefault();

  /* ── Combined key handler for password fields ── */
  const pwdKeyLogin = (e) => { blockClipboardKey(e); handleLoginKey(e); };
  const pwdKeySignup = (e) => { blockClipboardKey(e); handleSignupKey(e); };
  const pwdKeyReset = (e) => { blockClipboardKey(e); handleResetKey(e); };

  /* ── Forms ── */
  const LoginForm = (
    <div className="ls-form-section">
      <div>
        <p className="ls-form-eyebrow">Member Access</p>
        <h2 className="ls-form-heading">Sign In</h2>
        <p className="ls-form-subheading">Welcome back to GoodSoles PH</p>
      </div>
      <div className="ls-fields">
        <Field error={errors.email}>
          <input name="email" type="email" placeholder="Email address" value={formData.email} onChange={change} onKeyDown={handleLoginKey} />
        </Field>

        <div className="ls-field">
          <div className="ls-field-inner">
            <input name="password" type={showLoginPwd ? "text" : "password"} placeholder="Password"
              value={formData.password} onChange={change} onKeyDown={pwdKeyLogin}
              className="ls-input ls-input--with-icon"
              onCopy={blockClipboard} onPaste={blockClipboard} onCut={blockClipboard}
              onContextMenu={blockClipboard} aria-label="Password"
            />
            <button type="button" className="ls-pwd-toggle" onClick={() => setShowLoginPwd((s) => !s)} aria-label={showLoginPwd ? "Hide" : "Show"}>
              {showLoginPwd ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {errors.password && <p className="ls-error">{errors.password}</p>}
        </div>

        <div className="ls-forgot-row">
          <button className="ls-link-btn" onClick={() => switchMode("forgot")}>Forgot password?</button>
        </div>
      </div>

      <button className="ls-btn" onClick={login}><span>Sign In</span></button>
      <p className="ls-switch-prompt">Don't have an account?{" "}<button className="ls-link-btn" onClick={() => switchMode("signup")}>Create one</button></p>
    </div>
  );

  const SignupForm = (
    <div className="ls-form-section--tight">
      <div>
        <p className="ls-form-eyebrow">New Member</p>
        <h2 className="ls-form-heading">Create Account</h2>
        <p className="ls-form-subheading">Join the GoodSoles community</p>
      </div>

      <div className="ls-fields">
        <div className="ls-fields-grid">
          <Field error={errors.firstName}>
            <input name="firstName" type="text" placeholder="First name" value={formData.firstName} onKeyDown={handleSignupKey}
              onChange={(e) => { const v = e.target.value.replace(/[0-9]/g, "").slice(0, MAX_NAME); setErrors((p) => ({ ...p, firstName: "" })); setFormData((p) => ({ ...p, firstName: v })); }}
            />
          </Field>
          <Field error={errors.lastName}>
            <input name="lastName" type="text" placeholder="Last name" value={formData.lastName} onKeyDown={handleSignupKey}
              onChange={(e) => { const v = e.target.value.replace(/[0-9]/g, "").slice(0, MAX_NAME); setErrors((p) => ({ ...p, lastName: "" })); setFormData((p) => ({ ...p, lastName: v })); }}
            />
          </Field>
        </div>

        <Field error={errors.email}>
          <input name="email" type="email" placeholder="Email address" value={formData.email} onChange={change} onKeyDown={handleSignupKey} disabled={otpSent} />
        </Field>

        <Field error={errors.phone}>
          <input name="phone" type="text" inputMode="numeric" placeholder="Phone number (e.g. 09XXXXXXXXX)"
            value={formData.phone} maxLength={11} disabled={otpSent} onKeyDown={handleSignupKey}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 11); setErrors((p) => ({ ...p, phone: "" })); setFormData((p) => ({ ...p, phone: v })); }}
          />
        </Field>

        {/* Password */}
        <div className="ls-field">
          <div className="ls-field-inner">
            <input name="password" placeholder="Password" type={showSignupPwd ? "text" : "password"}
              value={formData.password} onChange={change} onKeyDown={pwdKeySignup}
              className="ls-input ls-input--with-icon" aria-label="Password"
              onCopy={blockClipboard} onPaste={blockClipboard} onCut={blockClipboard}
              onContextMenu={blockClipboard}
            />
            <button type="button" className="ls-pwd-toggle" onClick={() => setShowSignupPwd((s) => !s)} aria-label={showSignupPwd ? "Hide" : "Show"}>
              {showSignupPwd ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {errors.password && <p className="ls-error">{errors.password}</p>}
          {formData.password.length > 0 && (
            <ul className="ls-pwd-checklist">
              {signupPwdChecks.map((c) => (
                <li key={c.key} className={c.passed ? "check-pass" : "check-fail"}>
                  <span className="check-icon">{c.passed ? "✓" : "✗"}</span>{c.label}
                </li>
              ))}
            </ul>
          )}
          {pwStrength && <div className={`ls-pw-strength ls-pw-${pwStrength.toLowerCase()}`}>{pwStrength}</div>}
        </div>

        {/* Confirm password */}
        <div className="ls-field">
          <div className="ls-field-inner">
            <input name="confirmPassword" placeholder="Confirm password" type={showSignupConfirm ? "text" : "password"}
              value={formData.confirmPassword} onChange={change} onKeyDown={pwdKeySignup}
              className="ls-input ls-input--with-icon" aria-label="Confirm password"
              onCopy={blockClipboard} onPaste={blockClipboard} onCut={blockClipboard}
              onContextMenu={blockClipboard}
            />
            <button type="button" className="ls-pwd-toggle" onClick={() => setShowSignupConfirm((s) => !s)} aria-label={showSignupConfirm ? "Hide" : "Show"}>
              {showSignupConfirm ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {errors.confirmPassword && <p className="ls-error">{errors.confirmPassword}</p>}
        </div>
      </div>

      {/* Terms row */}
      <div>
        <div 
          className="ls-terms-row ls-terms-row--interactive" 
          onClick={() => !bothAgreed && setLegalModal("terms")}
        >
          <span
            className={`ls-terms-pseudo-checkbox${bothAgreed ? " ls-terms-pseudo-checkbox--checked" : ""}`}
            title={bothAgreed ? "You have agreed to both documents" : "Open each document below to read and agree"}
          >
            {bothAgreed ? "✓" : ""}
          </span>
          <span className="ls-terms-text">
            I agree to the{" "}
            <button
              type="button"
              className={`ls-terms-link-btn${termsAgreed ? " ls-terms-link-btn--done" : ""}`}
              onClick={(e) => { e.stopPropagation(); setLegalModal("terms"); }}
            >
              Terms of Use{termsAgreed ? " ✓" : " ↗"}
            </button>
            {" "}&amp;{" "}
            <button
              type="button"
              className={`ls-terms-link-btn${privacyAgreed ? " ls-terms-link-btn--done" : ""}`}
              onClick={(e) => { e.stopPropagation(); setLegalModal("privacy"); }}
            >
              Privacy Policy{privacyAgreed ? " ✓" : " ↗"}
            </button>
          </span>
        </div>
        {errors.agreed && <p className="ls-error ls-terms-error">{errors.agreed}</p>}
      </div>

      {!otpSent ? (
        <button className="ls-btn" onClick={sendOtp}><span>Continue</span></button>
      ) : (
        <div className="ls-otp-section">
          <p className="ls-otp-hint">Enter the 6-digit code sent to <strong>{formData.email}</strong></p>
          <MultiOtpInput value={otp} onChange={setOtp} error={errors.otp} />
          <button className="ls-btn" onClick={verifyOtp}><span>Verify &amp; Create Account</span></button>
          {/* Resend button — 60s → 120s → 180s cooldowns */}
          <ResendOtpButton
            key={resendKey}
            email={formData.email.trim()}
            type="signup"
            initialCooldownSeconds={60}
            onResendSuccess={() => { setOtp(""); setErrors((p) => ({ ...p, otp: "" })); }}
          />
        </div>
      )}

      <p className="ls-switch-prompt">Already have an account?{" "}<button className="ls-link-btn" onClick={() => switchMode("login")}>Sign in</button></p>
    </div>
  );

  const ForgotForm = (
    <div className="ls-form-section">
      <div>
        <button className="ls-link-btn ls-link-btn--back" onClick={() => switchMode("login")}>← Back to login</button>
        <p className="ls-form-eyebrow">Account Recovery</p>
        <h2 className="ls-form-heading">Forgot Password?</h2>
        <p className="ls-form-subheading">We'll send a reset code to your email</p>
      </div>
      <Field error={errors.email}>
        <input name="email" type="email" placeholder="Email address" value={formData.email} onChange={change} onKeyDown={handleForgotKey} />
      </Field>
      <button className="ls-btn" onClick={forgotPassword}><span>Send Reset Code</span></button>
    </div>
  );

  const ResetForm = (
    <div className="ls-form-section--tight">
      <div>
        <p className="ls-form-eyebrow">Account Recovery</p>
        <h2 className="ls-form-heading">Reset Password</h2>
        <p className="ls-form-subheading">Enter the code sent to your email and your new password</p>
      </div>

      <div className="ls-field">
        <div className="ls-field-inner">
          <input name="newPassword" placeholder="New password" type={showResetNewPwd ? "text" : "password"}
            value={formData.newPassword} onChange={change} onKeyDown={pwdKeyReset}
            className="ls-input ls-input--with-icon"
            onCopy={blockClipboard} onPaste={blockClipboard} onCut={blockClipboard}
            onContextMenu={blockClipboard}
          />
          <button type="button" className="ls-pwd-toggle" onClick={() => setShowResetNewPwd((s) => !s)} aria-label={showResetNewPwd ? "Hide" : "Show"}>
            {showResetNewPwd ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {errors.newPassword && <p className="ls-error">{errors.newPassword}</p>}
        {formData.newPassword && (
          <ul className="ls-pwd-checklist">
            {resetPwdChecks.map((c) => (
              <li key={c.key} className={c.passed ? "check-pass" : "check-fail"}>
                <span className="check-icon">{c.passed ? "✓" : "✗"}</span>{c.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ls-field">
        <div className="ls-field-inner">
          <input name="confirmPassword" placeholder="Confirm new password" type={showResetConfirmPwd ? "text" : "password"}
            value={formData.confirmPassword} onChange={change} onKeyDown={pwdKeyReset}
            className="ls-input ls-input--with-icon"
            onCopy={blockClipboard} onPaste={blockClipboard} onCut={blockClipboard}
            onContextMenu={blockClipboard}
          />
          <button type="button" className="ls-pwd-toggle" onClick={() => setShowResetConfirmPwd((s) => !s)} aria-label={showResetConfirmPwd ? "Hide" : "Show"}>
            {showResetConfirmPwd ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {errors.confirmPassword && <p className="ls-error">{errors.confirmPassword}</p>}
      </div>

      <MultiOtpInput value={otp} onChange={setOtp} error={errors.otp} />
      <button className="ls-btn" onClick={resetPassword}><span>Reset Password</span></button>

      {/* Resend button for forgot-password flow — 60s → 120s → 180s cooldowns */}
      <ResendOtpButton
        key={resendKey}
        email={formData.email.trim()}
        type="forgot"
        initialCooldownSeconds={60}
        onResendSuccess={() => { setOtp(""); setErrors((p) => ({ ...p, otp: "" })); }}
      />
    </div>
  );

  const currentForm = { login: LoginForm, signup: SignupForm, forgot: ForgotForm, reset: ResetForm }[mode];

  return (
    <>
      <div className="ls-page">
        <div className="ls-deco ls-deco-1">SOLES</div>
        <div className="ls-deco ls-deco-2">GS</div>
        <div className={`ls-card${animating ? " animating" : ""}`} style={{ flexDirection: brandLeft ? "row-reverse" : "row" }}>
          <div className="ls-brand"><BrandPanel /></div>
          <div className="ls-form"><div>{currentForm}</div></div>
        </div>
      </div>

      {legalModal && (
        <LegalModal
          type={legalModal}
          agreed={legalModal === "terms" ? termsAgreed : privacyAgreed}
          onClose={() => setLegalModal(null)}
          onAgree={(val) => {
            if (legalModal === "terms") setTermsAgreed(val);
            if (legalModal === "privacy") setPrivacyAgreed(val);
          }}
        />
      )}

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover draggable />
    </>
  );
};

export default LoginSignup;
