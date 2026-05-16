import React from 'react';
import s from './darkPageStyles';

const Careers = () => {
  return (
    <div style={s.pageContainer}>
      <div style={s.hero}>
        <div style={s.heroPattern}></div>
        <div style={s.heroContent}>
          <h1 style={s.heroTitle}>Careers</h1>
          <p style={s.heroSubtitle}>Join our team and make an impact</p>
        </div>
        <div style={s.heroDecoration}></div>
      </div>

      <div style={s.pageContent}>
        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Why Shopper</div>
          <h2 style={s.sectionTitle}>Why Work With Us?</h2>
          <div style={s.valuesGrid}>
            {[
              { icon: '📈', title: 'Growth Opportunities', desc: "We invest in our team's professional development" },
              { icon: '🎁', title: 'Great Benefits', desc: 'Competitive salary, health insurance, and employee discounts' },
              { icon: '⚡', title: 'Flexible Work', desc: 'Remote options and flexible schedules available' },
              { icon: '🤝', title: 'Inclusive Culture', desc: 'Diverse team that values every voice' },
            ].map((v, i) => (
              <div key={i} style={s.valueCard}>
                <div style={s.valueIcon}>{v.icon}</div>
                <h3 style={s.valueTitle}>{v.title}</h3>
                <p style={s.valueDesc}>{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Join Us</div>
          <h2 style={s.sectionTitle}>Open Positions</h2>

          {[
            { title: 'Senior Software Engineer', loc: '📍 Remote / New York', type: '💼 Full-time', pay: '💰 $120K - $160K', desc: "We're looking for an experienced software engineer to help build and scale our e-commerce platform.", featured: true },
            { title: 'Customer Service Representative', loc: '📍 Remote', type: '💼 Full-time', pay: '💰 $45K - $55K', desc: 'Join our customer service team to help create amazing experiences for our customers.' },
            { title: 'Marketing Manager', loc: '📍 Los Angeles', type: '💼 Full-time', pay: '💰 $80K - $100K', desc: 'Lead our marketing efforts across digital channels. Develop campaigns and grow our brand.' },
          ].map((job, i) => (
            <div key={i} style={s.jobCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={s.jobTitle}>{job.title}</h3>
                {job.featured && <span style={s.jobTag}>Featured</span>}
              </div>
              <div style={s.jobMeta}>
                <span>{job.loc}</span>
                <span>{job.type}</span>
                <span>{job.pay}</span>
              </div>
              <p style={s.jobDesc}>{job.desc}</p>
              <button style={{ ...s.ctaButton, marginTop: '16px' }}>Apply Now →</button>
            </div>
          ))}
        </section>

        <section style={s.ctaSection}>
          <h2 style={s.ctaTitle}>Don't See the Right Role?</h2>
          <p style={s.ctaDesc}>
            We're always looking for talented individuals. Send your resume to{' '}
            <span style={{ color: '#ffffff', fontWeight: 700 }}>jemsdimaala@gmail.com</span>
          </p>
          <button style={s.ctaButton}>Send Your Resume →</button>
        </section>
      </div>
    </div>
  );
};

export default Careers;
