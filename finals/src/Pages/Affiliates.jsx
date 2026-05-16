import React from 'react';
import s from './darkPageStyles';

const Affiliates = () => {
  return (
    <div style={s.pageContainer}>
      <div style={s.hero}>
        <div style={s.heroPattern}></div>
        <div style={s.heroContent}>
          <h1 style={s.heroTitle}>Affiliate Program</h1>
          <p style={s.heroSubtitle}>Partner with us and earn commissions</p>
        </div>
        <div style={s.heroDecoration}></div>
      </div>

      <div style={s.pageContent}>
        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Welcome</div>
          <h2 style={s.sectionTitle}>Join Our Affiliate Program</h2>
          <p style={{ ...s.paragraph, textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
            Love Shopper? Share your passion and earn money! Our affiliate program offers
            generous commissions for promoting our products to your audience.
          </p>
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Benefits</div>
          <h2 style={s.sectionTitle}>Program Benefits</h2>
          <div style={s.valuesGrid}>
            {[
              { icon: '💰', title: '10% Commission', desc: 'Earn on every sale you refer' },
              { icon: '🎯', title: '30-Day Cookies', desc: 'Get credit for sales within 30 days' },
              { icon: '📊', title: 'Real-Time Tracking', desc: 'Monitor your performance anytime' },
              { icon: '🎁', title: 'Exclusive Offers', desc: 'Special deals for your audience' },
            ].map((b, i) => (
              <div key={i} style={s.valueCard}>
                <div style={s.valueIcon}>{b.icon}</div>
                <h3 style={s.valueTitle}>{b.title}</h3>
                <p style={s.valueDesc}>{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Process</div>
          <h2 style={s.sectionTitle}>How It Works</h2>
          <div style={s.stepsGrid}>
            {[
              { n: '01', title: 'Sign Up', desc: 'Join our affiliate program for free' },
              { n: '02', title: 'Get Your Link', desc: 'Receive unique tracking links' },
              { n: '03', title: 'Promote', desc: 'Share products with your audience' },
              { n: '04', title: 'Earn', desc: 'Get paid monthly via PayPal' },
            ].map((step, i) => (
              <div key={i} style={s.stepCard}>
                <span style={s.stepNumber}>{step.n}</span>
                <h3 style={s.stepTitle}>{step.title}</h3>
                <p style={s.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Perfect For</div>
          <h2 style={s.sectionTitle}>Who Should Join?</h2>
          <ul style={s.featureList}>
            {[
              '✨ Fashion bloggers and influencers',
              '🎥 YouTube creators and content makers',
              '📱 Instagram and TikTok personalities',
              '🌐 Website owners and publishers',
              '❤️ Anyone passionate about footwear!',
            ].map((item, i) => (
              <li key={i} style={s.featureItem}>
                <span style={s.featureCheck}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section style={s.ctaSection}>
          <h2 style={s.ctaTitle}>Ready to Get Started?</h2>
          <p style={s.ctaDesc}>
            Apply today and start earning! For more information or questions,
            contact <span style={{ color: '#ffffff', fontWeight: 700 }}>affiliates@shopper.com</span>
          </p>
          <button style={s.ctaButton}>Apply Now →</button>
        </section>
      </div>
    </div>
  );
};

export default Affiliates;
