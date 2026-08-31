import React from 'react';
import { useNavigate } from 'react-router-dom';
import s from './darkPageStyles';

const ContactUs = () => {
  const navigate = useNavigate();

  return (
    <div style={s.pageContainer}>
      <div style={s.hero}>
        <div style={s.heroPattern}></div>
        <div style={s.heroContent}>
          <h1 style={s.heroTitle}>Contact Us</h1>
          <p style={s.heroSubtitle}>We're here to help! Reach out to us anytime</p>
        </div>
        <div style={s.heroDecoration}></div>
      </div>

      <div style={s.pageContent}>
        <div style={s.infoGrid}>
          <div style={s.infoCard}>
            <div style={s.infoIcon}>💬</div>
            <h3 style={s.infoTitle}>Chat with us</h3>
            <p style={{ ...s.infoText, color: 'var(--text-primary)' }}>10:00 AM - 10:00 PM</p>
            <button
              style={{ ...s.ctaButton, marginTop: '12px', width: '100%' }}
              onClick={() => window.dispatchEvent(new Event('open-chatbot'))}
            >
              Start Chat
            </button>
          </div>
          <div style={{ ...s.infoCard, background: 'rgba(var(--accent-gold-rgb),0.06)', borderColor: 'rgba(var(--accent-gold-rgb),0.2)' }}>
            <div style={s.infoIcon}>📞</div>
            <h3 style={s.infoTitle}>Call us</h3>
            <p style={{ ...s.infoText, color: 'var(--text-primary)', fontWeight: 700 }}>
              0967-442-6109 (Chawie)<br />0969-208-5673 (Kirky)<br />0923-205-1596 (Nicki)<br />0906-366-8108 (James)
            </p>
          </div>
          <div style={s.infoCard}>
            <div style={s.infoIcon}>📍</div>
            <h3 style={s.infoTitle}>Find a Store</h3>
            <p style={s.infoText}>Locate a store near you</p>
            <button
              style={{ ...s.ctaButton, marginTop: '12px', width: '100%' }}
              onClick={() => navigate('/', { state: { scrollTo: 'store-map' } })}
            >
              Find Store
            </button>
          </div>
        </div>

        <div style={s.infoGrid}>
          <div style={{ ...s.infoCard, borderLeft: '3px solid var(--text-primary)' }}>
            <h3 style={s.infoTitle}>📧 Email Support</h3>
            <p style={{ ...s.infoText, color: 'var(--text-primary)' }}>good-soles-ph@gmail.com</p>
            <p style={s.infoText}>We typically respond within 24 hours</p>
          </div>
          <div style={{ ...s.infoCard, borderLeft: '3px solid var(--text-primary)' }}>
            <h3 style={s.infoTitle}>🏢 Headquarters</h3>
            <p style={{ ...s.infoText, color: 'var(--text-primary)' }}>National University MOA</p>
            <p style={s.infoText}>Metro Manila, Philippines</p>
          </div>
          <div style={{ ...s.infoCard, borderLeft: '3px solid var(--text-primary)' }}>
            <h3 style={s.infoTitle}>⏰ Business Hours</h3>
            <p style={{ ...s.infoText, color: 'var(--text-primary)' }}>Mon-Fri: 10:00 AM - 10:00 PM</p>
            <p style={s.infoText}>Sat-Sun: 10:00 AM - 6:00 PM</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
