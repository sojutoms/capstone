import React, { useState, useRef } from "react";
import "./Hero.css";
import hero_video from "../Assets/hero_video.mp4";

const Hero = () => {
  const [isMuted, setIsMuted] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const videoRef = useRef(null);

  const handleMouseMove = (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 20;
    const y = (e.clientY / window.innerHeight - 0.5) * 20;
    setMousePos({ x, y });
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="hero-brutalist" onMouseMove={handleMouseMove}>
      {/* Background Video */}
      <video
        className="hero-bg"
        ref={videoRef}
        autoPlay
        muted={isMuted}
        loop
        playsInline
      >
        <source src={hero_video} type="video/mp4" />
      </video>

      {/* Gradient overlay for readability */}
      <div className="hero-overlay" />

      {/* Main Content */}
      <div 
        className="hero-content"
        style={{
          transform: `translate3d(${mousePos.x}px, ${mousePos.y}px, 0)`,
          transition: 'transform 0.1s ease-out'
        }}
      >
        <h1 className="hero-title">
          <span className="hero-title-line">
            STEP <em>INTO</em>
          </span>
          <span className="hero-title-line">
            SOMETHING <em>REAL.</em>
          </span>
        </h1>

        <p className="hero-desc">
          Curated sneakers, collectibles, bags &amp; watches.
          <br />
          Authentic. Always. Based in the Philippines.
        </p>

        {/* CTA Buttons */}
        <div className="hero-cta-row">
          <a href="/shoes" className="hero-btn-primary">
            Shop Now
          </a>
          <a href="/collectibles" className="hero-btn-ghost">
            View Collections
          </a>
        </div>

        {/* Trust Badges */}
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-dot" />
            <span className="hero-stat-text">200+ STYLES</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-dot" />
            <span className="hero-stat-text">100% AUTHENTIC</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-dot" />
            <span className="hero-stat-text">1-3 DAY PH DELIVERY</span>
          </div>
        </div>
      </div>

      {/* Mute Button */}
      <button
        className="hero-mute-btn"
        onClick={toggleMute}
        aria-label="Mute/Unmute"
      >
        {isMuted ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.09V4z" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        )}
      </button>

      {/* Scroll hint */}
      <div className="hero-scroll-hint">
        <span>Scroll</span>
        <div className="hero-scroll-line" />
      </div>
    </div>
  );
};

export default Hero;
