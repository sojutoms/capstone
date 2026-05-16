import React, { useState, useEffect } from "react";
import "./Banner.css";

// Slide content — update text to match your actual banner images
const SLIDE_DATA = [
    {
        tag: "Watches",
        title: "Fresh Drops.\nEvery Week.",
        sub: "The latest sneakers, collectibles & more — curated for the culture.",
        cta: "Shop Watches",
        href: "/watch",
    },
    {
        tag: "Bags",
        title: "Own a\nPiece of It.",
        sub: "Limited figures, rare finds, and statement pieces for collectors.",
        cta: "Shop Bags",
        href: "/bags",
    },
    {
        tag: "Collectibles",
        title: "Beyond\nthe Sole.",
        sub: "Premium watches and bags to complete the look.",
        cta: "Shop Collectibles",
        href: "/collectibles",
    },
];

const Banner = () => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState(0);

    const slides = [
        require("../Assets/Banner/1.png"),
        require("../Assets/Banner/2.png"),
        require("../Assets/Banner/3.png"),
    ];

    useEffect(() => {
        const autoPlay = setInterval(() => {
            setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
        }, 5000);
        return () => clearInterval(autoPlay);
    }, [slides.length]);

    const nextSlide = () => setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    const prevSlide = () => setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    const goToSlide = (index) => setCurrentSlide(index);

    const handleDragStart = (e) => {
        setIsDragging(true);
        setStartPos(e.type.includes("mouse") ? e.pageX : e.touches[0].clientX);
    };

    const handleDragEnd = (e) => {
        if (!isDragging) return;
        setIsDragging(false);
        const endPos = e.type.includes("mouse") ? e.pageX : e.changedTouches[0].clientX;
        const diff = startPos - endPos;
        if (diff > 50) nextSlide();
        else if (diff < -50) prevSlide();
    };

    return (
        <div className="hero-banner">

            {/* Slide counter */}
            <div className="banner-counter">
                <span>{String(currentSlide + 1).padStart(2, "0")}</span>
                {" / "}
                {String(slides.length).padStart(2, "0")}
            </div>

            <div
                className="banner-slider"
                onMouseDown={handleDragStart}
                onMouseUp={handleDragEnd}
                onTouchStart={handleDragStart}
                onTouchEnd={handleDragEnd}
            >
                <div
                    className="banner-track"
                    style={{
                        transform: `translateX(-${currentSlide * 100}%)`,
                        transition: isDragging ? "none" : "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)",
                    }}
                >
                    {slides.map((slide, index) => {
                        const data = SLIDE_DATA[index] || SLIDE_DATA[0];
                        return (
                            <div key={index} className="banner-slide">
                                <img src={slide} alt={`Banner ${index + 1}`} draggable="false" />

                                {/* Text overlay */}
                                <div className="banner-slide-content">
                                    <span className="banner-slide-tag">{data.tag}</span>
                                    <h2 className="banner-slide-title">
                                        {data.title.split("\n").map((line, i) => (
                                            <span key={i}>{line}<br /></span>
                                        ))}
                                    </h2>
                                    <p className="banner-slide-sub">{data.sub}</p>
                                    <a href={data.href} className="banner-slide-cta">
                                        {data.cta} →
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Nav buttons */}
            <button className="banner-nav-btn prev-btn" onClick={prevSlide} aria-label="Previous slide">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" />
                </svg>
            </button>
            <button className="banner-nav-btn next-btn" onClick={nextSlide} aria-label="Next slide">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter" />
                </svg>
            </button>

            {/* Dots */}
            <div className="banner-dots">
                {slides.map((_, index) => (
                    <button
                        key={index}
                        className={`dot ${currentSlide === index ? "active" : ""}`}
                        onClick={() => goToSlide(index)}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>

        </div>
    );
};

export default Banner;
