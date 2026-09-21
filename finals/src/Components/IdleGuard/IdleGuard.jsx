import React, { useEffect, useRef, useState, useCallback } from "react";
import "./IdleGuard.css";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

const IdleModal = ({ onLogout }) => (
  <div className="cust-idle-overlay">
    <div className="cust-idle-modal">
      <div className="cust-idle-modal__body">
        <div className="cust-idle-modal__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8"  x2="12"    y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          <p className="cust-idle-modal__title">Session Expired</p>
          <p className="cust-idle-modal__subtitle">
            You have been inactive for a while. Please sign in again to continue.
          </p>
        </div>
      </div>
      <div className="cust-idle-modal__actions">
        <button className="cust-idle-modal__btn" onClick={onLogout}>Sign in again</button>
      </div>
    </div>
  </div>
);

const IdleGuard = () => {
  const idleTimer = useRef(null);
  const showModalRef = useRef(false);
  const [showModal, setShowModal] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem("auth-token");
    showModalRef.current = false;
    setShowModal(false);
    window.location.replace("/login");
  }, []);

  const scheduleIdleCheck = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      showModalRef.current = true;
      setShowModal(true);
    }, IDLE_TIMEOUT_MS);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (showModalRef.current) return;
    scheduleIdleCheck();
  }, [scheduleIdleCheck]);

  useEffect(() => {
    const token = localStorage.getItem("auth-token");
    if (!token) return;

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, resetIdleTimer));
    scheduleIdleCheck();

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, resetIdleTimer));
      clearTimeout(idleTimer.current);
    };
  }, [resetIdleTimer, scheduleIdleCheck]);

  if (!showModal) return null;
  return <IdleModal onLogout={logout} />;
};

export default IdleGuard;
