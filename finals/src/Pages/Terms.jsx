import React from 'react';
import s from './darkPageStyles';

const Terms = () => {
    return (
        <div style={s.pageContainer}>
            <div style={s.hero}>
                <div style={s.heroPattern}></div>
                <div style={s.heroContent}>
                    <h1 style={s.heroTitle}>Terms of Service</h1>
                    <p style={s.heroSubtitle}>Our agreement with you</p>
                </div>
                <div style={s.heroDecoration}></div>
            </div>

            <div style={s.pageContent}>
                <section style={s.contentSection}>
                    <p style={{ ...s.legalText, fontStyle: 'italic' }}>Last updated: October 2025</p>
                    <h2 style={s.legalHeading}>Acceptance of Terms</h2>
                    <p style={s.legalText}>
                        By accessing and using Sneaky Concepts website, you accept and agree to be bound by
                        these Terms of Service. If you do not agree, please do not use our services.
                    </p>
                </section>

                <section style={s.contentSection}>
                    <h2 style={s.legalHeading}>Use of Service</h2>
                    <p style={s.legalText}>You agree to:</p>
                    <ul style={s.legalList}>
                        {['Provide accurate account information', 'Maintain the security of your password', 'Not use the service for illegal purposes', "Not interfere with the service's operation"].map((item, i) => (
                            <li key={i} style={s.legalListItem}>{item}</li>
                        ))}
                    </ul>
                </section>

                <section style={s.contentSection}>
                    <h2 style={s.legalHeading}>Product Information</h2>
                    <p style={s.legalText}>
                        We strive to provide accurate product descriptions and images. However, we do
                        not warrant that product descriptions or other content is accurate, complete,
                        reliable, or error-free.
                    </p>
                </section>

                <section style={s.contentSection}>
                    <h2 style={s.legalHeading}>Pricing and Payment</h2>
                    <p style={s.legalText}>
                        All prices are in USD and subject to change. We reserve the right to refuse or
                        cancel orders for any reason, including errors in pricing or product information.
                    </p>
                </section>

                <section style={s.contentSection}>
                    <h2 style={s.legalHeading}>Intellectual Property</h2>
                    <p style={s.legalText}>
                        All content on this website, including text, graphics, logos, and images, is
                        the property of Sneaky Concepts and protected by copyright laws.
                    </p>
                </section>

                <section style={s.contentSection}>
                    <h2 style={s.legalHeading}>Limitation of Liability</h2>
                    <p style={s.legalText}>
                        Sneaky Concepts shall not be liable for any indirect, incidental, special, or
                        consequential damages resulting from the use or inability to use our service.
                    </p>
                </section>

                <section style={s.contentSection}>
                    <h2 style={s.legalHeading}>Contact</h2>
                    <p style={s.legalText}>
                        Questions about these Terms? Contact us at{' '}
                        <span style={{ color: '#ffffff' }}>sneaky-concepts@legal.com</span>
                    </p>
                </section>
            </div>
        </div>
    );
};

export default Terms;
