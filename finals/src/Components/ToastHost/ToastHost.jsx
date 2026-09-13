import React, { useEffect, useRef, useState } from "react";
import { subscribeToast } from "../../utils/toast";
import "./ToastHost.css";

const ToastHost = () => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  useEffect(() => {
    const unsubscribe = subscribeToast((toast) => {
      setToasts((prev) => [...prev, toast]);
      timers.current[toast.id] = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        delete timers.current[toast.id];
      }, toast.duration);
    });
    const activeTimers = timers.current;
    return () => {
      unsubscribe();
      Object.values(activeTimers).forEach(clearTimeout);
    };
  }, []);

  const dismiss = (id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="global-toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <div key={t.id} className={`global-toast ${t.type}`}>
          <span>{t.message}</span>
          <button className="global-toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
};

export default ToastHost;
