import React from "react";
import { Link } from "react-router-dom";
import "./Footer.css";
import footer_logo from "../Assets/logo.png";
import instagram_icon from "../Assets/instagram_icon.png";
import facebook_icon from "../Assets/facebook_icon.png";
import youtube_icon from "../Assets/youtube_icon.png";

const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-master-grid">

                {/* ── Brand ── */}
                <div className="footer-cell brand-cell">
                    <img src={footer_logo} alt="GoodSoles PH" className="footer-logo" />
                    <p className="footer-description">
                        Your go-to destination for curated sneakers, collectibles, bags, and watches.
                        Authentic. Always. Based in the Philippines.
                    </p>
                </div>

                {/* ── Newsletter ── */}
                <div className="footer-cell newsletter-cell">
                    <h3>Join the Collective</h3>
                    <p>Gain priority access to limited drops, curated collections, and private events.</p>
                    <div className="newsletter-form">
                        <input
                            type="email"
                            placeholder="Priority Email"
                            className="newsletter-input"
                        />
                        <button className="newsletter-button">Register</button>
                    </div>
                    
                    <div className="footer-complimentary-services">
                        <div className="service-item">
                            <span className="service-icon">✦</span>
                            <span className="service-text">AUTHENTICITY CERTIFIED</span>
                        </div>
                        <div className="service-item">
                            <span className="service-icon">✦</span>
                            <span className="service-text">SECURE TRANSACTIONS</span>
                        </div>
                        <div className="service-item">
                            <span className="service-icon">✦</span>
                            <span className="service-text">EXPERT CURATION</span>
                        </div>
                    </div>
                </div>

                {/* ── Quick Links ── */}
                <div className="footer-cell">
                    <h3>Quick Links</h3>
                    <ul className="footer-links-grid">
                        <li><Link to="/AboutUs">About Us</Link></li>
                        <li><Link to="/shop">Shop</Link></li>
                        <li><Link to="/gift-cards">Gift Cards</Link></li>
                    </ul>
                </div>

                {/* ── Service ── */}
                <div className="footer-cell">
                    <h3>Service</h3>
                    <ul className="footer-links-grid">
                        <li><Link to="/contact">Contact Us</Link></li>
                        <li><Link to="/shipping">Shipping Info</Link></li>
                        <li><Link to="/returns">Returns</Link></li>
                        <li><Link to="/size-guide">Size Guide</Link></li>
                        <li><Link to="/track-order">Track Order</Link></li>
                    </ul>
                </div>

                {/* ── Company ── */}
                <div className="footer-cell">
                    <h3>Company</h3>
                    <ul className="footer-links-grid">
                        <li><Link to="/our-story">Our Story</Link></li>
                        <li><Link to="/careers">Careers</Link></li>
                        <li><Link to="/sustainability">Sustainability</Link></li>
                        <li><Link to="/press">Press</Link></li>
                        <li><Link to="/affiliates">Affiliates</Link></li>
                    </ul>
                </div>

                {/* ── Comms & Socials ── */}
                <div className="footer-cell comms-cell">
                    <h3>Comms Link</h3>
                    <div className="footer-contact-info">
                        <p><strong>E:</strong> goodsoles.ph@gmail.com</p>
                        <p><strong>P:</strong> 0967-442-6109</p>
                        <p><strong>H:</strong> Mon–Sun 10:00 AM – 9:00 PM</p>
                    </div>
                    <div className="footer-social-icon">
                        <a href="https://www.instagram.com/goodsolesphofficial/" target="_blank" rel="noreferrer" aria-label="Instagram">
                            <img src={instagram_icon} alt="Instagram" />
                        </a>
                        <a href="https://www.facebook.com/goodsoles.ph/" target="_blank" rel="noreferrer" aria-label="Facebook">
                            <img src={facebook_icon} alt="Facebook" />
                        </a>
                        <a href="https://www.youtube.com/@goodsolesphtv6526" target="_blank" rel="noreferrer" aria-label="YouTube">
                            <img src={youtube_icon} alt="YouTube" />
                        </a>
                    </div>
                </div>

            </div>

            {/* ── Bottom legal bar ── */}
            <div className="footer-bottom-wrapper">
                <div className="footer-bottom">
                    <div className="footer-legal">
                        <p>Copyright © 2026 GoodSoles PH — All rights reserved.</p>
                        <div className="footer-legal-links">
                            <Link to="/privacy">Privacy Policy</Link>
                            <Link to="/terms">Terms of Service</Link>
                            <Link to="/cookies">Cookie Policy</Link>
                        </div>
                    </div>
                    <div className="footer-payment">
                        <p className="payment-title">We Accept:</p>
                        <div className="payment-methods">
                            <span title="Credit Card">💳</span>
                            <span title="Bank Transfer">🏦</span>
                            <span title="GCash / E-wallet">📱</span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
