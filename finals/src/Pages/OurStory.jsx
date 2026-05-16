import React from 'react';
import s from './darkPageStyles';

const OurStory = () => {
  return (
    <div style={s.pageContainer}>
      <div style={s.hero}>
        <div style={s.heroPattern}></div>
        <div style={s.heroContent}>
          <h1 style={s.heroTitle}>Our Story</h1>
          <p style={s.heroSubtitle}>The journey of Shopper</p>
        </div>
        <div style={s.heroDecoration}></div>
      </div>

      <div style={s.pageContent}>
        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Origin</div>
          <h2 style={s.sectionTitle}>How It All Began</h2>
          <div style={s.storyContent}>
            <p style={s.paragraph}>
              <span style={s.dropCap}>I</span>n 2022, our founder, Kirk Palmiano, had a simple yet powerful vision: to create
              a destination where shoe lovers could find premium footwear from around the world
              all in one place. What started as an idea became the beginning of a journey to bring
              confidence and joy to customers.
            </p>
            <p style={s.paragraph}>
              Our passion for quality footwear and exceptional customer service has been the
              driving force behind everything we do. We believe that shoes are more than just
              accessories — they're expressions of personality, comfort companions, and confidence boosters.
            </p>
          </div>
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Timeline</div>
          <h2 style={s.sectionTitle}>Our Journey</h2>
          <div style={s.stepsGrid}>
            {[
              { year: '2022', title: 'The Beginning', desc: 'It all started with a single pair of sneakers.' },
              { year: '2023', title: 'Recognized', desc: 'Sold over 500 pairs of shoes' },
              { year: '2024', title: 'Growing', desc: 'Sold over thousand of pairs' },
              { year: '2025', title: 'Thriving Today', desc: 'Serving 2500+ satisfied customers' },
            ].map((t, i) => (
              <div key={i} style={s.stepCard}>
                <span style={s.stepNumber}>{t.year}</span>
                <h3 style={s.stepTitle}>{t.title}</h3>
                <p style={s.stepDesc}>{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={s.ctaSection}>
          <h2 style={s.ctaTitle}>🎯 Our Mission</h2>
          <p style={s.ctaDesc}>
            To bring together the finest shoes from around the world, offering customers high-quality,
            stylish, and comfortable footwear that empowers them to walk with confidence and joy.
          </p>
        </section>

        <section style={s.ctaSection}>
          <h2 style={s.ctaTitle}>👁️ Our Vision</h2>
          <p style={s.ctaDesc}>
            To become the leading destination for premium footwear, inspiring confidence
            and self-expression in every step.
          </p>
        </section>
      </div>
    </div>
  );
};

export default OurStory;
