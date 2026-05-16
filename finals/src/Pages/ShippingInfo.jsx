import React from 'react';
import s from './darkPageStyles';

const ShippingInfo = () => {
  return (
    <div style={s.pageContainer}>
      <div style={s.hero}>
        <div style={s.heroPattern}></div>
        <div style={s.heroContent}>
          <h1 style={s.heroTitle}>Shipping Information</h1>
          <p style={s.heroSubtitle}>Fast and reliable delivery worldwide</p>
        </div>
        <div style={s.heroDecoration}></div>
      </div>

      <div style={s.pageContent}>
        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Delivery Options</div>
          <h2 style={s.sectionTitle}>Shipping Options</h2>
          <div style={s.tierGrid}>
            {[
              { icon: '📦', title: 'Standard Shipping', price: '₱100.00', desc: 'Delivery in 5-7 business days' },
              { icon: '⚡', title: 'Express Shipping', price: '₱150.00', desc: 'Delivery in 2-3 business days' },
              { icon: '🚀', title: 'Next Day Delivery', price: '₱250.00', desc: 'Order by 2PM for next day delivery' },
            ].map((opt, i) => (
              <div key={i} style={i === 2 ? { ...s.tierCard, ...s.tierCardHighlighted } : s.tierCard}>
                <div style={{ fontSize: '2.4rem', marginBottom: '12px' }}>{opt.icon}</div>
                <h3 style={s.tierTitle}>{opt.title}</h3>
                <div style={s.tierPrice}>{opt.price}</div>
                <p style={s.valueDesc}>{opt.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={s.ctaSection}>
          <h2 style={s.ctaTitle}>🎁 Free Shipping</h2>
          <p style={s.ctaDesc}>Enjoy free standard shipping on orders over ₱5,000.00!</p>
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Worldwide</div>
          <h2 style={s.sectionTitle}>International Shipping</h2>
          <p style={{ ...s.paragraph, textAlign: 'center', maxWidth: '800px', margin: '0 auto 24px' }}>
            We ship to over 100 countries worldwide. International shipping rates and delivery times vary by location.
          </p>
          <div style={s.statsGrid}>
            {[
              { code: 'CA', name: 'Canada', time: '7-10 business days' },
              { code: 'EU', name: 'Europe', time: '10-14 business days' },
              { code: 'AS', name: 'Asia', time: '12-16 business days' },
              { code: 'AU', name: 'Australia', time: '10-14 business days' },
            ].map((c, i) => (
              <div key={i} style={s.statCard}>
                <div style={s.statNumber}>{c.code}</div>
                <div style={{ ...s.infoTitle, fontSize: '0.95rem', marginTop: '8px' }}>{c.name}</div>
                <div style={s.statLabel}>{c.time}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={s.ctaSection}>
          <h2 style={s.ctaTitle}>✉️ Order Processing</h2>
          <p style={s.ctaDesc}>
            Orders are processed within 1-2 business days. You'll receive a confirmation email with tracking information once your order ships.
          </p>
        </section>
      </div>
    </div>
  );
};

export default ShippingInfo;
