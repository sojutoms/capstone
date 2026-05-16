import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import "./RefundModal.css";
import API_BASE_URL from "../../services/api";

const normalizeStatus = (s) =>
  String(s || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-+/g, "_");

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "video/webm"];
const MAX_FILES = 6;
const MAX_SIZE_MB = 50;

const RefundModal = ({ order, open, onClose, onSubmit }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? open : internalOpen;

  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]); // [{file, preview, type}]
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Keep a ref always in sync with state so callbacks never capture stale values
  const mediaFilesRef = useRef([]);
  useEffect(() => {
    mediaFilesRef.current = mediaFiles;
  }, [mediaFiles]);

  const reasonRef = useRef("");
  useEffect(() => {
    reasonRef.current = reason;
  }, [reason]);

  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef({});
  const toastRootRef = useRef(null);

  useEffect(() => {
    const root = document.createElement("div");
    root.className = "refund-toast-root";
    document.body.appendChild(root);
    toastRootRef.current = root;
    return () => {
      if (toastRootRef.current) {
        document.body.removeChild(toastRootRef.current);
        toastRootRef.current = null;
      }
    };
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    if (toastTimersRef.current[id]) {
      clearTimeout(toastTimersRef.current[id]);
      delete toastTimersRef.current[id];
    }
  }, []);

  const addToast = useCallback((type, message, duration = 4000) => {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, type, message }]);
    if (duration > 0) {
      const timer = setTimeout(() => removeToast(id), duration);
      toastTimersRef.current[id] = timer;
    }
    return id;
  }, [removeToast]);

  const safeClose = useCallback(() => {
    mediaFilesRef.current.forEach((m) => { if (m.preview) URL.revokeObjectURL(m.preview); });
    if (isControlled) {
      if (typeof onClose === "function") onClose();
    } else {
      setInternalOpen(false);
    }
    setReason("");
    setNotes("");
    setMediaFiles([]);
    mediaFilesRef.current = [];
    reasonRef.current = "";
    setLoading(false);
    setToasts([]);
    Object.values(toastTimersRef.current).forEach((t) => clearTimeout(t));
    toastTimersRef.current = {};
  }, [isControlled, onClose]);

  useEffect(() => {
    return () => {
      Object.values(toastTimersRef.current).forEach((t) => clearTimeout(t));
      toastTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") safeClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, safeClose]);

  // Process a FileList or array of File objects and add valid ones to state
  const processFiles = useCallback((fileList) => {
    const current = mediaFilesRef.current;
    const remaining = MAX_FILES - current.length;
    if (remaining <= 0) {
      addToast("error", `Maximum ${MAX_FILES} files allowed.`);
      return;
    }
    const files = Array.from(fileList || []);
    const toAdd = [];
    for (const file of files.slice(0, remaining)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        addToast("error", `"${file.name}" is not a supported format. Use JPG, PNG, WebP, GIF, MP4, MOV, or WebM.`);
        continue;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        addToast("error", `"${file.name}" exceeds ${MAX_SIZE_MB}MB limit.`);
        continue;
      }
      const isVideo = file.type.startsWith("video/");
      toAdd.push({ file, preview: URL.createObjectURL(file), type: isVideo ? "video" : "image" });
    }
    if (toAdd.length > 0) {
      setMediaFiles((prev) => [...prev, ...toAdd]);
    }
  }, [addToast]);

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // Reset so same file can be selected again after removal
    if (e.target) e.target.value = "";
  };

  const removeMedia = useCallback((idx) => {
    setMediaFiles((prev) => {
      const updated = [...prev];
      if (updated[idx]?.preview) URL.revokeObjectURL(updated[idx].preview);
      updated.splice(idx, 1);
      return updated;
    });
  }, []);

  // Validate using refs so we always see current values regardless of closure timing
  const validate = useCallback(() => {
    const currentReason = reasonRef.current;
    const currentFiles  = mediaFilesRef.current;

    if (!(currentReason || "").trim()) {
      addToast("error", "Please select a reason for the refund.");
      setTimeout(() => document.getElementById("refund-reason")?.focus(), 50);
      return false;
    }
    if (currentFiles.length === 0) {
      addToast("error", "Please attach at least one photo or video showing the issue.");
      return false;
    }
    return true;
  }, [addToast]);

  const handleSubmit = useCallback(async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (e && typeof e.stopPropagation === "function") e.stopPropagation();

    // Read from refs for guaranteed fresh values
    const currentReason = reasonRef.current;
    const currentFiles  = mediaFilesRef.current;

    if (!(currentReason || "").trim()) {
      addToast("error", "Please select a reason for the refund.");
      setTimeout(() => document.getElementById("refund-reason")?.focus(), 50);
      return;
    }
    if (currentFiles.length === 0) {
      addToast("error", "Please attach at least one photo or video showing the issue.");
      return;
    }

    setLoading(true);

    try {
      if (typeof onSubmit === "function") {
        try {
          await onSubmit(currentReason, notes, currentFiles.map((m) => m.file));
          addToast("success", "Refund request submitted.");
          safeClose();
        } catch (err) {
          console.error("Parent onSubmit error:", err);
          addToast("error", err?.message || "Failed to submit refund request.");
        } finally {
          setLoading(false);
        }
        return;
      }

      if (!order || !order.orderNumber) {
        addToast("error", "Order information missing.");
        setLoading(false);
        return;
      }

      const token = localStorage.getItem("auth-token");
      const formData = new FormData();
      formData.append("reason", currentReason);
      const currentNotes = notes.trim();
      if (currentNotes) formData.append("notes", currentNotes);
      currentFiles.forEach((m) => formData.append("media", m.file));

      const res = await fetch(`${API_BASE_URL}/order/${order.orderNumber}/refund`, {
        method: "POST",
        headers: { "auth-token": token },
        body: formData,
      });

      let data;
      try { data = await res.json(); }
      catch {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Server returned status ${res.status}`);
      }

      if (!res.ok) {
        addToast("error", data?.error || data?.message || `Server error (${res.status})`);
      } else if (!data.success) {
        addToast("error", data?.error || data?.message || "Refund request failed");
      } else {
        addToast("success", "Refund request submitted.");
        safeClose();
      }
    } catch (err) {
      console.error("Refund submit error:", err);
      addToast("error", err?.message || "Failed to submit refund request. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [notes, order, onSubmit, addToast, safeClose]);

  if (!isOpen) {
    if (isControlled) return null;
    const disabled = !(order && normalizeStatus(order.status) === "completed");
    return (
      <button
        type="button"
        className={`refund-trigger-btn ${disabled ? "disabled" : ""}`}
        onClick={(e) => { e.stopPropagation(); if (disabled) return; setInternalOpen(true); }}
        disabled={disabled}
      >
        Request Refund
      </button>
    );
  }

  const toastMarkup = (
    <div className="toast-container" aria-live="polite" aria-atomic="true" role="status">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type === "success" ? "success" : t.type === "error" ? "error" : ""}`}>
          <div className="toast-message">
            {t.type === "success" ? "✓" : t.type === "error" ? "!" : "i"}
            <span style={{ marginLeft: 8 }}>{t.message}</span>
          </div>
          <button className="toast-close" onClick={() => removeToast(t.id)} aria-label="Dismiss notification">×</button>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {toastRootRef.current ? createPortal(toastMarkup, toastRootRef.current) : null}

      <div className="refund-modal-overlay" onClick={() => safeClose()} role="presentation">
        <div
          className="refund-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-modal-title"
        >
          <div className="refund-modal-header">
            <div>
              <h2 id="refund-modal-title">Request a Refund</h2>
              <p>Tell us why and attach photo/video proof of the issue.</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); safeClose(); }}
              className="modal-close-btn"
              aria-label="Close refund modal"
            >
              ✕
            </button>
          </div>

          <div className="refund-order-info">
            <div><strong>Order</strong>: {order?.orderNumber || "—"}</div>
            <div><strong>Date</strong>: {order?.timestamp ? new Date(order.timestamp).toLocaleString() : "—"}</div>
            <div><strong>Status</strong>: {order?.status ? normalizeStatus(order.status) : "—"}</div>
          </div>

          <form className="refund-form" onSubmit={handleSubmit}>
            {/* ── Reason ── */}
            <div className="form-group">
              <label htmlFor="refund-reason">Reason for refund <span className="refund-required">*</span></label>
              <select
                id="refund-reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  reasonRef.current = e.target.value;
                }}
                required
              >
                <option value="">Select a reason</option>
                <option value="Item not as described">Item not as described</option>
                <option value="Wrong item received">Wrong item received</option>
                <option value="Damaged or defective">Damaged or defective</option>
                <option value="Size/fit issue">Size/fit issue</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* ── Notes (optional) ── */}
            <div className="form-group">
              <label htmlFor="refund-notes">Additional details <span className="refund-optional">(optional)</span></label>
              <textarea
                id="refund-notes"
                placeholder="Any extra context you'd like to share…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* ── Media upload ── */}
            <div className="form-group">
              <label>
                Photos / Videos <span className="refund-required">*</span>
                <span className="refund-media-hint"> — up to {MAX_FILES} files, max {MAX_SIZE_MB}MB each</span>
              </label>

              {/* Drop zone */}
              <div
                className={`refund-dropzone ${mediaFiles.length >= MAX_FILES ? "refund-dropzone--full" : ""}`}
                onClick={() => mediaFiles.length < MAX_FILES && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("refund-dropzone--drag"); }}
                onDragLeave={(e) => e.currentTarget.classList.remove("refund-dropzone--drag")}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("refund-dropzone--drag");
                  if (mediaFilesRef.current.length >= MAX_FILES) return;
                  processFiles(e.dataTransfer.files);
                }}
                role="button"
                tabIndex={mediaFiles.length < MAX_FILES ? 0 : -1}
                aria-label="Upload photos or videos"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
              >
                {mediaFiles.length === 0 ? (
                  <>
                    <div className="refund-dropzone-icon">📎</div>
                    <div className="refund-dropzone-label">
                      Click or drag &amp; drop photos/videos here
                    </div>
                    <div className="refund-dropzone-sub">JPG, PNG, WebP, GIF, MP4, MOV, WebM</div>
                  </>
                ) : mediaFiles.length < MAX_FILES ? (
                  <div className="refund-dropzone-add">
                    <span>＋ Add more</span>
                    <span className="refund-dropzone-sub">{mediaFiles.length}/{MAX_FILES} files</span>
                  </div>
                ) : (
                  <div className="refund-dropzone-add refund-dropzone-add--full">
                    <span>Max {MAX_FILES} files reached</span>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                multiple
                style={{ display: "none" }}
                onChange={handleFileChange}
              />

              {/* Preview grid */}
              {mediaFiles.length > 0 && (
                <div className="refund-media-grid">
                  {mediaFiles.map((m, idx) => (
                    <div key={idx} className="refund-media-thumb">
                      {m.type === "video" ? (
                        <video src={m.preview} className="refund-media-preview" muted playsInline />
                      ) : (
                        <img src={m.preview} alt={`Attachment ${idx + 1}`} className="refund-media-preview" />
                      )}
                      <span className="refund-media-badge">{m.type === "video" ? "🎥" : "🖼"}</span>
                      <button
                        type="button"
                        className="refund-media-remove"
                        onClick={(e) => { e.stopPropagation(); removeMedia(idx); }}
                        aria-label={`Remove attachment ${idx + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <small className="hint">
                Required — attach photos or videos so we can verify the issue before processing your refund.
              </small>
            </div>

            <div className="refund-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={(e) => { e.stopPropagation(); safeClose(); }}
                disabled={loading}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-warning" disabled={loading}>
                {loading ? "Submitting…" : "Submit Refund Request"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default RefundModal;
