import React from 'react';
import s from './darkPageStyles';

const GiftCards = () => {
  return (
    <div style={s.pageContainer}>
      <div style={s.hero}>
        <div style={s.heroPattern}></div>
        <div style={s.heroContent}>
          <h1 style={s.heroTitle}>Gift Cards</h1>
          <p style={s.heroSubtitle}>The perfect gift for shoe lovers</p>
        </div>
        <div style={s.heroDecoration}></div>
      </div>

      <div style={s.pageContent}>
        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Perfect Gift</div>
          <h2 style={s.sectionTitle}>Give the Gift of Choice</h2>
          <p style={{ ...s.paragraph, textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
            Not sure what size or style to choose? Let them pick! Our gift cards are
            perfect for birthdays, holidays, or any special occasion.
          </p>
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Amounts</div>
          <h2 style={s.sectionTitle}>Available Amounts</h2>
          <div style={s.tierGrid}>
            {[
              { icon: '🎁', amount: '$25', desc: 'Perfect for accessories' },
              { icon: '💝', amount: '$50', desc: 'Great starter amount' },
              { icon: '🎀', amount: '$100', desc: 'Most popular choice' },
              { icon: '✨', amount: 'Custom', desc: 'Choose any amount' },
            ].map((g, i) => (
              <div key={i} style={i === 2 ? { ...s.tierCard, ...s.tierCardHighlighted } : s.tierCard}>
                <div style={{ fontSize: '2.4rem', marginBottom: '12px' }}>{g.icon}</div>
                <div style={s.tierPrice}>{g.amount}</div>
                <p style={s.valueDesc}>{g.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Features</div>
          <h2 style={s.sectionTitle}>Gift Card Features</h2>
          <ul style={s.featureList}>
            {['Never expires - use anytime', 'Instant email delivery available', 'Can be used online or in-store', 'Combine multiple gift cards', 'Check balance online anytime'].map((f, i) => (
              <li key={i} style={s.featureItem}><span style={s.featureCheck}>✓</span>{f}</li>
            ))}
          </ul>
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Instructions</div>
          <h2 style={s.sectionTitle}>How to Use</h2>
          <p style={{ ...s.paragraph, textAlign: 'center', maxWidth: '700px', margin: '0 auto' }}>
            Simply enter the gift card code at checkout. If your purchase exceeds the
            gift card value, you can pay the difference with another payment method.
          </p>
        </section>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <button style={s.ctaButton}>Purchase Gift Card</button>
        </div>
      </div>
    </div>
  );
};

export default GiftCards;
