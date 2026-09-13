import { useState } from "react";
import "./NewsLetter.css";
import { subscribeNewsletter } from "../../services/api";
import { showToast } from "../../utils/toast";

const NewsLetter = () => {
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || subscribing) return;

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
      <form className="newsletter-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Priority Email"
          className="newsletter-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={subscribing}
          required
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
