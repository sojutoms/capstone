import React, { useState } from 'react';
import s from './darkPageStyles';

const ContactUs = () => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Thank you for contacting us! We will get back to you soon.');
    setFormData({ name: '', email: '', subject: '', message: '' });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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
            <p style={{ ...s.infoText, color: '#ffffff' }}>10:00 AM - 10:00 PM</p>
            <button style={{ ...s.ctaButton, marginTop: '12px', width: '100%' }}>Start Chat</button>
          </div>
          <div style={{ ...s.infoCard, background: 'rgba(201,162,39,0.06)', borderColor: 'rgba(201,162,39,0.2)' }}>
            <div style={s.infoIcon}>📞</div>
            <h3 style={s.infoTitle}>Call us</h3>
            <p style={{ ...s.infoText, color: '#ffffff', fontWeight: 700 }}>
              0967-442-6109 (Chawie)<br />0969-208-5673 (Kirky)<br />0923-205-1596 (Nicki)<br />0906-366-8108 (James)
            </p>
          </div>
          <div style={s.infoCard}>
            <div style={s.infoIcon}>📍</div>
            <h3 style={s.infoTitle}>Find a Store</h3>
            <p style={s.infoText}>Locate a store near you</p>
            <button style={{ ...s.ctaButton, marginTop: '12px', width: '100%' }}>Find Store</button>
          </div>
        </div>

        <section style={{ ...s.contentSection, marginTop: '28px' }}>
          <div style={s.sectionBadge}>Get in Touch</div>
          <h2 style={s.sectionTitle}>Send us a Message</h2>
          <p style={{ ...s.paragraph, textAlign: 'center', maxWidth: '600px', margin: '0 auto 28px' }}>
            Have a question or feedback? Fill out the form below and we'll get back to you as soon as possible.
          </p>
          <form onSubmit={handleSubmit} style={{ maxWidth: '700px', margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <div style={s.formGroup}>
                <label style={s.label}>Your Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} style={s.input} placeholder="Kirk Palmiano" required />
              </div>
              <div style={s.formGroup}>
                <label style={s.label}>Email Address</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} style={s.input} placeholder="user@example.com" required />
              </div>
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Subject</label>
              <input type="text" name="subject" value={formData.subject} onChange={handleChange} style={s.input} placeholder="How can we help you?" required />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>Message</label>
              <textarea name="message" value={formData.message} onChange={handleChange} style={s.textarea} placeholder="Tell us more about your inquiry..." rows="6" required />
            </div>
            <button type="submit" style={s.submitButton}>Send Message →</button>
          </form>
        </section>

        <div style={s.infoGrid}>
          <div style={{ ...s.infoCard, borderLeft: '3px solid #ffffff' }}>
            <h3 style={s.infoTitle}>📧 Email Support</h3>
            <p style={{ ...s.infoText, color: '#ffffff' }}>sneaky-concept@gmail.com</p>
            <p style={s.infoText}>We typically respond within 24 hours</p>
          </div>
          <div style={{ ...s.infoCard, borderLeft: '3px solid #ffffff' }}>
            <h3 style={s.infoTitle}>🏢 Headquarters</h3>
            <p style={{ ...s.infoText, color: '#ffffff' }}>National University MOA</p>
            <p style={s.infoText}>Metro Manila, Philippines</p>
          </div>
          <div style={{ ...s.infoCard, borderLeft: '3px solid #ffffff' }}>
            <h3 style={s.infoTitle}>⏰ Business Hours</h3>
            <p style={{ ...s.infoText, color: '#ffffff' }}>Mon-Fri: 10:00 AM - 10:00 PM</p>
            <p style={s.infoText}>Sat-Sun: 10:00 AM - 6:00 PM</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
