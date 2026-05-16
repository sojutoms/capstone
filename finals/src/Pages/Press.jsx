import React from 'react';
import s from './darkPageStyles';

const Press = () => {
  return (
    <div style={s.pageContainer}>
      <div style={s.hero}>
        <div style={s.heroPattern}></div>
        <div style={s.heroContent}>
          <h1 style={s.heroTitle}>Press</h1>
          <p style={s.heroSubtitle}>News and media resources</p>
        </div>
        <div style={s.heroDecoration}></div>
      </div>

      <div style={s.pageContent}>
        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Media</div>
          <h2 style={s.sectionTitle}>Press &amp; Media</h2>
          <p style={s.paragraph}>
            For press inquiries, interviews, or media resources, please contact our communications team.
            We're happy to provide brand assets, product images, and company information.
          </p>
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Coverage</div>
          <h2 style={s.sectionTitle}>Recent Coverage</h2>
          {[
            { title: 'Rising Stars in Philippine E-Commerce', source: 'Business Insider PH', date: 'March 2025', desc: 'Sneaky Concepts featured as one of the fastest-growing sneaker retailers in the Philippines.' },
            { title: 'The Future of Sneaker Culture', source: 'Hypebeast SEA', date: 'January 2025', desc: 'How Sneaky Concepts is reshaping the way Filipinos discover and buy premium footwear.' },
            { title: 'Top Online Shoe Stores', source: 'Manila Bulletin', date: 'November 2024', desc: 'Sneaky Concepts ranked among the top 10 online shoe destinations in Metro Manila.' },
          ].map((article, i) => (
            <div key={i} style={s.jobCard}>
              <h3 style={s.jobTitle}>{article.title}</h3>
              <div style={s.jobMeta}>
                <span>{article.source}</span>
                <span>{article.date}</span>
              </div>
              <p style={s.jobDesc}>{article.desc}</p>
            </div>
          ))}
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>At a Glance</div>
          <h2 style={s.sectionTitle}>Company Facts</h2>
          <div style={s.statsGrid}>
            {[
              { num: '2022', label: 'Founded' },
              { num: '2,500+', label: 'Customers' },
              { num: '1,000+', label: 'Products' },
              { num: '4.8★', label: 'Avg Rating' },
            ].map((stat, i) => (
              <div key={i} style={s.statCard}>
                <div style={s.statNumber}>{stat.num}</div>
                <div style={s.statLabel}>{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={s.ctaSection}>
          <h2 style={s.ctaTitle}>Press Inquiries</h2>
          <p style={s.ctaDesc}>
            For media requests, contact{' '}
            <span style={{ color: '#ffffff', fontWeight: 700 }}>press@sneakyconcepts.com</span>
          </p>
          <button style={s.ctaButton}>Download Press Kit</button>
        </section>
      </div>
    </div>
  );
};

export default Press;
