import React from 'react';
import s from './darkPageStyles';

const Cookies = () => {
    return (
        <div style={s.pageContainer}>
            <div style={s.hero}>
                <div style={s.heroPattern}></div>
                <div style={s.heroContent}>
                    <h1 style={s.heroTitle}>Cookie Policy</h1>
                    <p style={s.heroSubtitle}>How we use cookies</p>
                </div>
                <div style={s.heroDecoration}></div>
            </div>

            <div style={s.pageContent}>
                <section style={s.contentSection}>
                    <p style={{ ...s.paragraph, fontStyle: 'italic' }}>Last updated: October 2025</p>
                    <h2 style={s.legalHeading}>What Are Cookies?</h2>
                    <p style={s.legalText}>
                        Cookies are small text files stored on your device when you visit our website.
                        They help us provide you with a better experience by remembering your preferences
                        and understanding how you use our site.
                    </p>
                </section>

                <section style={s.contentSection}>
                    <div style={s.sectionBadge}>Types</div>
                    <h2 style={s.sectionTitle}>Types of Cookies We Use</h2>
                    {[
                        { title: 'Essential Cookies', desc: 'Required for the website to function properly. These include cookies for your shopping cart and security features.' },
                        { title: 'Performance Cookies', desc: 'Help us understand how visitors interact with our website by collecting anonymous information about pages visited.' },
                        { title: 'Functional Cookies', desc: 'Remember your preferences and choices, such as language settings and recently viewed products.' },
                        { title: 'Marketing Cookies', desc: 'Used to deliver relevant advertisements and track advertising campaign effectiveness.' },
                    ].map((item, i) => (
                        <div key={i} style={{ ...s.featureItem, marginBottom: '12px' }}>
                            <span style={s.featureCheck}>✓</span>
                            <div>
                                <strong style={{ color: '#ffffff', display: 'block', marginBottom: '4px' }}>{item.title}</strong>
                                <span>{item.desc}</span>
                            </div>
                        </div>
                    ))}
                </section>

                <section style={s.contentSection}>
                    <h2 style={s.legalHeading}>Managing Cookies</h2>
                    <p style={s.legalText}>
                        You can control and manage cookies through your browser settings. However,
                        disabling certain cookies may affect your ability to use some features of our website.
                    </p>
                </section>

                <section style={s.contentSection}>
                    <h2 style={s.legalHeading}>Questions?</h2>
                    <p style={s.legalText}>
                        If you have questions about our use of cookies, please contact{' '}
                        <span style={{ color: '#ffffff' }}>sneaky-concepts-privacy@gmail.com</span>
                    </p>
                </section>
            </div>
        </div>
    );
};

export default Cookies;
