import React from 'react';
import s from './darkPageStyles';

const AboutUs = () => {
    return (
        <div style={s.pageContainer}>
            <div style={s.hero}>
                <div style={s.heroPattern}></div>
                <div style={s.heroContent}>
                    <h1 style={s.heroTitle}>About Us</h1>
                    <p style={s.heroSubtitle}>Discover the story behind your favorite shoe destination</p>
                </div>
                <div style={s.heroDecoration}></div>
            </div>

            <div style={s.pageContent}>
                <section style={s.contentSection}>
                    <div style={s.sectionBadge}>Our Journey</div>
                    <h2 style={s.sectionTitle}>Our Story</h2>
                    <div style={s.storyContent}>
                        <p style={s.paragraph}>
                            <span style={s.dropCap}>F</span>ounded in 2022, GOODSOLES.PH began with a simple mission: to bring premium footwear
                            from around the world to your doorstep. What started as a small passion project
                            has grown into a trusted destination for shoe enthusiasts everywhere.
                        </p>
                        <p style={s.paragraph}>
                            We believe that the right pair of shoes can transform not just your outfit, but
                            your confidence. That's why we're committed to curating only the finest selection
                            of footwear from established brands and emerging designers alike.
                        </p>
                    </div>
                </section>

                <section style={{ ...s.contentSection, ...s.valuesSection }}>
                    <div style={{ ...s.sectionBadge, ...s.valueBadge }}>What We Stand For</div>
                    <h2 style={s.sectionTitle}>Our Values</h2>
                    <div style={s.valuesGrid}>
                        {[
                            { icon: '🏆', title: 'Quality First', desc: 'Every product in our collection meets quality standards.' },
                            { icon: '❤️', title: 'Customer Focus', desc: 'Your satisfaction is our top priority, from browsing to delivery.' },
                            { icon: '🌱', title: 'Sustainability', desc: 'We partner with brands that share our commitment to the environment.' },
                            { icon: '⚡', title: 'Innovation', desc: 'Always seeking the latest styles and technology in footwear.' }
                        ].map((value, idx) => (
                            <div key={idx} style={s.valueCard}>
                                <div style={s.valueIcon}>{value.icon}</div>
                                <h3 style={s.valueTitle}>{value.title}</h3>
                                <p style={s.valueDesc}>{value.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section style={s.contentSection}>
                    <div style={s.sectionBadge}>Why Shop With Us</div>
                    <h2 style={s.sectionTitle}>Why Choose Us?</h2>
                    <ul style={s.featureList}>
                        {[
                            'Carefully curated collection from top global brands',
                            'Authentic products with quality guarantee',
                            'Fast and reliable shipping worldwide',
                            'Exceptional customer service team',
                            'Easy returns and exchanges',
                            'Competitive pricing and exclusive deals'
                        ].map((feature, idx) => (
                            <li key={idx} style={s.featureItem}>
                                <span style={s.featureCheck}>✓</span>
                                {feature}
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
};

export default AboutUs;
