import React from 'react';
import s from './darkPageStyles';

const SizeGuide = () => {
  const mensSizes = [
    { us: '7', uk: '6', eu: '40', cm: '25.0' },
    { us: '8', uk: '7', eu: '41', cm: '25.5' },
    { us: '9', uk: '8', eu: '42', cm: '26.0' },
    { us: '10', uk: '9', eu: '43', cm: '27.0' },
    { us: '11', uk: '10', eu: '44', cm: '27.5' },
    { us: '12', uk: '11', eu: '45', cm: '28.0' },
  ];
  const womensSizes = [
    { us: '6', uk: '4', eu: '36', cm: '22.5' },
    { us: '7', uk: '5', eu: '37', cm: '23.0' },
    { us: '8', uk: '6', eu: '38', cm: '23.5' },
    { us: '9', uk: '7', eu: '39', cm: '24.0' },
    { us: '10', uk: '8', eu: '40', cm: '25.0' },
    { us: '11', uk: '9', eu: '41', cm: '25.5' },
  ];

  const renderTable = (data) => (
    <div style={{ overflowX: 'auto', borderRadius: '12px', marginTop: '20px' }}>
      <table style={s.table}>
        <thead>
          <tr>
            {['US Size', 'UK Size', 'EU Size', 'CM'].map((h, i) => (
              <th key={i} style={s.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td style={s.td}>{row.us}</td>
              <td style={s.td}>{row.uk}</td>
              <td style={s.td}>{row.eu}</td>
              <td style={s.td}>{row.cm}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={s.pageContainer}>
      <div style={s.hero}>
        <div style={s.heroPattern}></div>
        <div style={s.heroContent}>
          <h1 style={s.heroTitle}>Size Guide</h1>
          <p style={s.heroSubtitle}>Find your perfect fit</p>
        </div>
        <div style={s.heroDecoration}></div>
      </div>

      <div style={s.pageContent}>
        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Measuring</div>
          <h2 style={s.sectionTitle}>How to Measure Your Feet</h2>
          <ul style={s.featureList}>
            {[
              "Measure your feet at the end of the day when they're largest",
              'Stand on a piece of paper and trace your foot',
              'Measure from heel to longest toe',
              'Use the measurement in inches or centimeters',
              'If between sizes, we recommend sizing up',
            ].map((f, i) => (
              <li key={i} style={s.featureItem}><span style={s.featureCheck}>✓</span>{f}</li>
            ))}
          </ul>
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Men's Sizes</div>
          <h2 style={s.sectionTitle}>Men's Shoe Size Chart</h2>
          {renderTable(mensSizes)}
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Women's Sizes</div>
          <h2 style={s.sectionTitle}>Women's Shoe Size Chart</h2>
          {renderTable(womensSizes)}
        </section>

        <section style={s.contentSection}>
          <div style={s.sectionBadge}>Width Options</div>
          <h2 style={s.sectionTitle}>Width Guide</h2>
          <div style={s.valuesGrid}>
            {[
              { label: 'Narrow (B)', desc: 'For feet that are slimmer than average' },
              { label: 'Medium (D)', desc: 'Standard width for most people' },
              { label: 'Wide (E/EE)', desc: 'For feet that are wider than average' },
            ].map((w, i) => (
              <div key={i} style={s.valueCard}>
                <h3 style={s.valueTitle}>{w.label}</h3>
                <p style={s.valueDesc}>{w.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SizeGuide;
