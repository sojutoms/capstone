import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import "./CSS/Shop.css";
import Hero from "../Components/Hero/Hero";
import Banner from "../Components/Banner/Banner";
import Popular from "../Components/Popular/Popular";
import NewCollections from "../Components/NewCollections/NewCollections";
import NewsLetter from "../Components/NewsLetter/NewsLetter";
import SocialFeed from "../Components/SocialFeed/SocialFeed";
import StoreMap from "../Components/Storemap/StoreMap";

const Shop = () => {
    const location = useLocation();

    // Lets other pages (e.g. Contact Us's "Find Store" button) land here and
    // land the user straight on the store map instead of the top of the page.
    useEffect(() => {
        if (location.state?.scrollTo === "store-map") {
            const timer = setTimeout(() => {
                document.getElementById("store-map")?.scrollIntoView({ behavior: "instant", block: "start" });
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [location.state]);

    return (
        <div className="shop-page">
            <Hero />
            <div className="shop-split-layout">
                <div className="shop-main-col">
                    <NewCollections />
                </div>
                <div className="shop-side-col">
                    <Popular />
                </div>
            </div>
            <Banner />

            {/* Social feed + store map side by side below the banner */}
            <div className="shop-community-row">
                <div className="shop-community-col">
                    <SocialFeed />
                </div>
                <div className="shop-community-col">
                    <StoreMap />
                </div>
            </div>

            <NewsLetter />
        </div>
    );
};

export default Shop;
