import { useRef, useState } from "react";
import "./NewsLetter.css";
import { subscribeNewsletter } from "../../services/api";
import { showToast } from "../../utils/toast";

// Client-side throttle: same window as the backend (5 attempts per 60s per IP)
// so the user can't spam the toast either.
const ATTEMPT_WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const NewsLetter = () => {
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const attemptTimesRef = useRef([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (subscribing) return;

    // Prune old attempts outside the window, then check the count.
    const now = Date.now();
    attemptTimesRef.current = attemptTimesRef.current.filter((t) => now - t < ATTEMPT_WINDOW_MS);
    if (attemptTimesRef.current.length >= MAX_ATTEMPTS) {
      showToast("error", "Too many attempts. Please wait a moment.");
      return;
    }
    attemptTimesRef.current.push(now);

    if (!trimmed) { showToast("error", "Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      showToast("error", "Enter a valid email.");
      return;
    }

    setSubscribing(true);
    try {
      const data = await subscribeNewsletter(trimmed);
      if (data.success) {
        showToast("success", data.message || "You're in.");
        setEmail("");
      } else {
        showToast("error", data.error || "Something went wrong. Please try again.");
      }
    } catch {
      showToast("error", "Network error. Please try again.");
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="newsletter-banner">
      <h3>Join the Collective</h3>
      <p>Gain priority access to limited drops, curated collections, and private events.</p>
      <form className="newsletter-form" onSubmit={handleSubmit} noValidate>
        <input
          type="text"
          placeholder="Priority Email"
          className="newsletter-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={subscribing}
        />
        <button type="submit" className="newsletter-button" disabled={subscribing}>
          {subscribing ? "..." : "Register"}
        </button>
      </form>

      <div className="footer-complimentary-services">
        <div className="service-item">
          <span className="service-icon">✦</span>
          <span className="service-text">AUTHENTICITY CERTIFIED</span>
        </div>
        <div className="service-item">
          <span className="service-icon">✦</span>
          <span className="service-text">SECURE TRANSACTIONS</span>
        </div>
        <div className="service-item">
          <span className="service-icon">✦</span>
          <span className="service-text">EXPERT CURATION</span>
        </div>
      </div>
    </div>
  );
};

export default NewsLetter;
