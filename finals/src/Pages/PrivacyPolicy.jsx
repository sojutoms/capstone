import React from 'react';
import s from './darkPageStyles';

const PrivacyPolicy = () => {
    return (
        <div style={s.pageContainer}>
            <div style={s.hero}>
                <div style={s.heroPattern}></div>
                <div style={s.heroContent}>
                    <h1 style={s.heroTitle}>Privacy Policy</h1>
                    <p style={s.heroSubtitle}>How we protect your information</p>
                </div>
                <div style={s.heroDecoration}></div>
            </div>

            <div style={s.pageContent}>
                <section style={s.contentSection}>
                    <p style={{ ...s.legalText, fontStyle: 'italic' }}>Last updated: October 2025</p>
                    <h2 style={s.legalHeading}>Introduction</h2>
                    <p style={s.legalText}>
                        At Sneaky Concepts, we take your privacy seriously. This Privacy Policy explains how we
                        collect, use, and protect your personal information when you use our website and services.
                    </p>
                </section>

                <section style={s.contentSection}>
                    <h2 style={s.legalHeading}>Information We Collect</h2>
                    <p style={{ ...s.legalText, color: '#ffffff', fontWeight: 600 }}>Personal Information:</p>
                    <ul style={s.legalList}>
                        {['Name, email address, and phone number', 'Shipping and billing addresses', 'Payment information (processed securely)', 'Order history and preferences'].map((item, i) => (
                            <li key={i} style={s.legalListItem}>{item}</li>
                        ))}
                    </ul>
                    <p style={{ ...s.legalText, color: '#ffffff', fontWeight: 600, marginTop: '16px' }}>Automatic Information:</p>
                    <ul style={s.legalList}>
                        {['Browser type and IP address', 'Cookies and usage data', 'Device information'].map((item, i) => (
                            <li key={i} style={s.legalListItem}>{item}</li>
                        ))}
                    </ul>
                </section>

                <section style={s.contentSection}>
                    <h2 style={s.legalHeading}>How We Use Your Information</h2>
                    <ul style={s.legalList}>
                        {['Process and fulfill your orders', 'Communicate about your orders and account', 'Improve our website and services', 'Send marketing communications (with your consent)', 'Prevent fraud and enhance security'].map((item, i) => (
                            <li key={i} style={s.legalListItem}>{item}</li>
                        ))}
                    </ul>
                </section>

                <section style={s.contentSection}>
                    <h2 style={s.legalHeading}>Information Sharing</h2>
                    <p style={s.legalText}>
                        We do not sell your personal information. We only share data with trusted
                        service providers who help us operate our business, such as payment processors
                        and shipping companies.
                    </p>
                </section>

                <section style={s.contentSection}>
                    <h2 style={s.legalHeading}>Your Rights</h2>
                    <ul style={s.legalList}>
                        {['Access your personal data', 'Request corrections or deletions', 'Opt-out of marketing emails', 'Disable cookies in your browser'].map((item, i) => (
                            <li key={i} style={s.legalListItem}>{item}</li>
                        ))}
                    </ul>
                </section>

                <section style={s.contentSection}>
                    <h2 style={s.legalHeading}>Contact Us</h2>
                    <p style={s.legalText}>
                        If you have questions about this Privacy Policy, please contact us at{' '}
                        <span style={{ color: '#ffffff' }}>sneaky-concepts-privacy@gmail.com</span>
                    </p>
                </section>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
