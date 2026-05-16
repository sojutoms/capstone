import React, { useEffect, useRef } from "react";
import "./InsightModal.css";

const InsightModal = ({ insight, onClose }) => {
  const overlayRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  if (!insight) return null;

  return (
    <div className="insight-modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="insight-modal">
        <button className="insight-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className={`insight-modal-header ${insight.type}`}>
          <div className="insight-modal-icon">{insight.icon}</div>
          <div>
            <h2 className="insight-modal-title">{insight.title}</h2>
            <p className="insight-modal-subtitle">{insight.summary}</p>
          </div>
        </div>

        <div className="insight-modal-body">
          {insight.loading ? (
            <div className="insight-modal-loading">
              <div className="modal-spinner"></div>
              <p>Analyzing data…</p>
            </div>
          ) : (
            insight.content
          )}
        </div>
      </div>
    </div>
  );
};

export default InsightModal;
