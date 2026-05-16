import React, { useEffect, useState, useRef, useCallback } from "react";
import "./ReviewModal.css";
import API_BASE_URL from "../../services/api";

// ─── Profanity filter (lightweight, no API key needed) ────────────────────────
// Install with: npm install bad-words
// Falls back gracefully if the package is unavailable.
let Filter;
try {
  // CJS / ESM dual-package: works with both import styles
  const badWords = require("bad-words");
  Filter = badWords.Filter || badWords.default || badWords;
} catch {
  Filter = null;
}

const profanityFilter = Filter ? new Filter() : null;

/**
 * Returns { clean, hasProfanity }
 * `clean`       – censored version of the text (bad words replaced with ***)
 * `hasProfanity`– true if at least one word was replaced
 */
const checkAndClean = (text) => {
  if (!profanityFilter || !text) return { clean: text, hasProfanity: false };
  try {
    const clean = profanityFilter.clean(text);
    return { clean, hasProfanity: clean !== text };
  } catch {
    // bad-words throws when the entire input is a bad word
    return { clean: "***", hasProfanity: true };
  }
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const ReviewModal = ({ product, onReviewSubmit, open, onClose }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? open : internalOpen;

  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [title, setTitle] = useState("");
  const [fit, setFit] = useState("");
  const [comfort, setComfort] = useState("");
  const [recommend, setRecommend] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Profanity warning state
  const [profanityWarning, setProfanityWarning] = useState("");

  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const removeToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const addToast = useCallback(
    (type, message, duration = 4000) => {
      const id = ++toastIdRef.current;
      setToasts((t) => [...t, { id, type, message }]);
      if (duration > 0) setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  const resetForm = useCallback(() => {
    setRating(0);
    setReview("");
    setTitle("");
    setFit("");
    setComfort("");
    setRecommend("");
    setAgreed(false);
    setLoading(false);
    setSubmitted(false);
    setToasts([]);
    setProfanityWarning("");
  }, []);

  const safeClose = useCallback(() => {
    if (isControlled) {
      if (typeof onClose === "function") onClose();
    } else {
      setInternalOpen(false);
    }
    setTimeout(resetForm, 300);
  }, [isControlled, onClose, resetForm]);

  useEffect(() => {
    if (isOpen) resetForm();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") safeClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, safeClose]);

  // ── Review text change: live profanity check ──────────────────────────────
  const handleReviewChange = (e) => {
    const raw = e.target.value;
    setReview(raw);

    if (!profanityFilter) {
      setProfanityWarning("");
      return;
    }

    try {
      const { hasProfanity } = checkAndClean(raw);
      setProfanityWarning(
        hasProfanity
          ? "⚠️ Your review contains inappropriate language. It will be automatically censored before publishing."
          : ""
      );
    } catch {
      setProfanityWarning("");
    }
  };

  // ── Title change: live profanity check ───────────────────────────────────
  const handleTitleChange = (e) => {
    setTitle(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) { addToast("error", "Please select a rating"); return; }
    if (review.trim().length < 10) { addToast("error", "Review must be at least 10 characters"); return; }
    if (!agreed) { addToast("error", "Please agree to the terms"); return; }

    const productId = product?.id ?? product?._id ?? null;
    if (!productId) {
      addToast("error", "Product not found. Please try again.");
      return;
    }

    // ── Sanitize before sending ───────────────────────────────────────────
    const { clean: cleanReview } = checkAndClean(review.trim());
    const { clean: cleanTitle }  = checkAndClean(title.trim());

    setLoading(true);
    try {
      const token = localStorage.getItem("auth-token");

      const payload = {
        productId,
        rating,
        review:    cleanReview,   // censored text sent to server
        title:     cleanTitle,
        fit,
        comfort,
        recommend,
      };

      const res = await fetch(`${API_BASE_URL}/addreview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "auth-token": token } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        setSubmitted(true);
        setLoading(false);
        if (typeof onReviewSubmit === "function") {
          await onReviewSubmit(payload);
        }
        if (!isControlled) {
          setTimeout(() => safeClose(), 2000);
        }
      } else {
        addToast("error", data.message || data.error || "Error submitting review");
        setLoading(false);
      }
    } catch (err) {
      console.error("Error submitting review:", err);
      addToast("error", "Error submitting review");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="review-modal-overlay"
      onClick={() => safeClose()}
      role="presentation"
    >
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${
              t.type === "success" ? "success" : t.type === "error" ? "error" : ""
            }`}
          >
            <div className="toast-message">
              {t.type === "success" ? "✓" : t.type === "error" ? "!" : "i"}
              <span style={{ marginLeft: 8 }}>{t.message}</span>
            </div>
            <button
              className="toast-close"
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div
        className="review-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {submitted ? (
          <div className="review-success-screen">
            <div className="review-success-icon">✓</div>
            <h3 className="review-success-title">Review Submitted!</h3>
            <p className="review-success-body">
              Thanks for sharing your feedback on{" "}
              <strong>{product?.name}</strong>. Your review helps other
              shoppers make better decisions.
            </p>
            <p className="review-success-closing">Thank you!</p>
          </div>
        ) : (
          <>
            <div className="review-modal-header">
              <div>
                <h2>Write a Review</h2>
                <p>Share your thoughts with the community.</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  safeClose();
                }}
                className="modal-close-btn"
                aria-label="Close review modal"
              >
                ✕
              </button>
            </div>

            <div className="review-product-info">
              <img src={product?.image} alt={product?.name} />
              <span>{product?.name}</span>
            </div>

            <form onSubmit={handleSubmit} className="review-form">
              <div className="form-group">
                <label>Overall rating *</label>
                <div className="star-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star ${rating >= star ? "filled" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRating(star);
                      }}
                      aria-label={`${star} star`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Your Review *</label>
                <textarea
                  value={review}
                  onChange={handleReviewChange}
                  placeholder="Describe what you liked, what you didn't like and other key things shoppers should know."
                  maxLength={5000}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <small>{review.length}/5000</small>
                </div>
                {/* Live profanity warning */}
                {profanityWarning && (
                  <div className="profanity-warning">
                    {profanityWarning}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Review title</label>
                <input
                  type="text"
                  value={title}
                  onChange={handleTitleChange}
                  placeholder="Summarize your review in 150 characters or less."
                  maxLength={150}
                />
                <small>{title.length}/150</small>
              </div>

              <div className="form-group">
                <label>How did this product fit?</label>
                <div className="radio-group">
                  {["Runs Small", "True to Size", "Runs Big"].map((option) => (
                    <label key={option} className="radio-label">
                      <input
                        type="radio"
                        name="fit"
                        value={option}
                        checked={fit === option}
                        onChange={(e) => setFit(e.target.value)}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>How comfortable was this product?</label>
                <div className="radio-group">
                  {["Uncomfortable", "Average", "Very Comfortable"].map(
                    (option) => (
                      <label key={option} className="radio-label">
                        <input
                          type="radio"
                          name="comfort"
                          value={option}
                          checked={comfort === option}
                          onChange={(e) => setComfort(e.target.value)}
                        />
                        {option}
                      </label>
                    )
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Would you recommend this product?</label>
                <div className="radio-group">
                  {["Yes", "No"].map((option) => (
                    <label key={option} className="radio-label">
                      <input
                        type="radio"
                        name="recommend"
                        value={option}
                        checked={recommend === option}
                        onChange={(e) => setRecommend(e.target.value)}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group agreement">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <span>
                    I agree to the terms and conditions and understand my
                    review may be used for marketing purposes.
                  </span>
                </label>
              </div>

              {/* Content policy notice */}
              <div className="review-policy-notice">
                Reviews are automatically checked for inappropriate language. Offensive content will be censored or rejected.
              </div>

              <div className="button-row">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    safeClose();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? "Submitting..." : "Submit"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ReviewModal;
