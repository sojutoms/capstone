import React from 'react';
import s from './darkPageStyles';

const Returns = () => {
  return (
    <div style={s.pageContainer}>
      <div style={s.hero}>
        <div style={s.heroPattern}></div>
        <div style={s.heroContent}>
          <h1 style={s.heroTitle}>Returns &amp; Exchanges</h1>
          <p style={s.heroSubtitle}>Easy returns within 30 days</p>
        </div>
        <div style={s.heroDecoration}></div>
      </div>

      <div style={s.pageContent}>
        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Policy</div>
          <h2 style={s.sectionTitle}>Our Return Policy</h2>
          <p style={{ ...s.paragraph, textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
            We want you to love your purchase! If you're not completely satisfied, we offer free returns within 30 days of delivery.
          </p>
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Requirements</div>
          <h2 style={s.sectionTitle}>Return Requirements</h2>
          <ul style={s.featureList}>
            {['Items must be unworn and in original condition', 'Original packaging and tags must be attached', 'Return must be initiated within 30 days of delivery', 'Proof of purchase required'].map((f, i) => (
              <li key={i} style={s.featureItem}><span style={s.featureCheck}>✓</span>{f}</li>
            ))}
          </ul>
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Process</div>
          <h2 style={s.sectionTitle}>How to Return</h2>
          <div style={s.stepsGrid}>
            {[
              { n: '01', icon: '👤', title: 'Log In', desc: 'Log into your account and go to Order History' },
              { n: '02', icon: '📦', title: 'Select Item', desc: 'Select the item you want to return and choose a reason' },
              { n: '03', icon: '🖨️', title: 'Print Label', desc: 'Print your prepaid return label' },
              { n: '04', icon: '🚚', title: 'Ship It', desc: 'Pack your item and drop it off at any shipping location' },
            ].map((step, i) => (
              <div key={i} style={s.stepCard}>
                <span style={s.stepNumber}>{step.n}</span>
                <div style={{ fontSize: '2rem', marginBottom: '10px' }}>{step.icon}</div>
                <h3 style={s.stepTitle}>{step.title}</h3>
                <p style={s.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={s.ctaSection}>
          <h2 style={s.ctaTitle}>🔄 Easy Exchanges</h2>
          <p style={s.ctaDesc}>
            Need a different size or color? We offer free exchanges! Simply return your item and place a new order.
          </p>
        </section>

        <section style={s.ctaSection}>
          <h2 style={s.ctaTitle}>💰 Quick Refunds</h2>
          <p style={s.ctaDesc}>
            Refunds are processed within 5-7 business days after we receive your return. The refund will be issued to your original payment method.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Returns;
