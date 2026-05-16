import React from 'react';
import s from './darkPageStyles';

const Sustainability = () => {
  return (
    <div style={s.pageContainer}>
      <div style={s.hero}>
        <div style={s.heroPattern}></div>
        <div style={s.heroContent}>
          <h1 style={s.heroTitle}>Sustainability</h1>
          <p style={s.heroSubtitle}>Our commitment to the planet</p>
        </div>
        <div style={s.heroDecoration}></div>
      </div>

      <div style={s.pageContent}>
        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Our Promise</div>
          <h2 style={s.sectionTitle}>Our Environmental Promise</h2>
          <p style={{ ...s.paragraph, textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
            At Shopper, we believe in doing business responsibly. We're committed to reducing
            our environmental impact and partnering with brands that share our values.
            Sustainability isn't just a buzzword for us—it's a core principle that guides
            our decisions every day.
          </p>
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Actions</div>
          <h2 style={s.sectionTitle}>What We're Doing</h2>
          <div style={s.valuesGrid}>
            {[
              { icon: '🌱', title: 'Eco-Friendly Packaging', desc: '100% recyclable materials and minimal plastic use' },
              { icon: '♻️', title: 'Recycling Program', desc: 'Send back old shoes for recycling and get a discount' },
              { icon: '🌍', title: 'Carbon Neutral Shipping', desc: 'We offset carbon emissions from all deliveries' },
              { icon: '🤝', title: 'Ethical Partnerships', desc: 'Working only with brands that meet our ethical standards' },
            ].map((v, i) => (
              <div key={i} style={s.valueCard}>
                <div style={s.valueIcon}>{v.icon}</div>
                <h3 style={s.valueTitle}>{v.title}</h3>
                <p style={s.valueDesc}>{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={s.ctaSection}>
          <h2 style={s.ctaTitle}>🏷️ Sustainable Brands</h2>
          <p style={s.ctaDesc}>
            We carefully curate our collection to include brands that prioritize sustainability,
            fair labor practices, and eco-friendly materials. Look for our{' '}
            <span style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', padding: '3px 10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Eco-Friendly</span>{' '}
            badge when shopping to find sustainable options.
          </p>
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>2026-2029</div>
          <h2 style={s.sectionTitle}>Our Goals</h2>
          <div style={s.stepsGrid}>
            {[
              { year: '2026', icon: '📦', text: 'Achieve 100% sustainable packaging' },
              { year: '2027', icon: '🌿', text: 'Partner with 50+ certified sustainable brands' },
              { year: '2028', icon: '👟', text: 'Recycle 1 million pairs of shoes' },
              { year: '2029', icon: '⚡', text: 'Reduce warehouse energy consumption by 50%' },
            ].map((g, i) => (
              <div key={i} style={s.stepCard}>
                <span style={s.stepNumber}>{g.year}</span>
                <div style={{ fontSize: '2rem', marginBottom: '10px' }}>{g.icon}</div>
                <p style={s.stepDesc}>{g.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Sustainability;
