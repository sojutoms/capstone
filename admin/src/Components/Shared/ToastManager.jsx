import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";

export const useToastManager = () => {
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

export const Toasts = ({ toasts, removeToast }) =>
  createPortal(
    <div className="toast-root" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <div className="toast-body">
            <div className="toast-message">{t.message}</div>
            {t.actions?.length > 0 && (
              <div className="toast-actions">
                {t.actions.map((a, i) => (
                  <button
                    key={i}
                    className={`toast-action ${a.variant || ""}`}
                    onClick={() => {
                      try { a.onClick?.(); } catch (e) { console.error(e); } finally { removeToast(t.id); }
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="toast-close" onClick={() => removeToast(t.id)}>✕</button>
        </div>
      ))}
    </div>,
    document.body
  );