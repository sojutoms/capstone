import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        // `html { scroll-behavior: smooth }` is set globally, which makes even
        // this "instant" reset animate — and race with anything that wants a
        // deliberate smooth scroll shortly after navigating (e.g. Contact Us's
        // "Find Store" button scrolling to the store map on the home page).
        // Explicit `behavior: "instant"` opts out of that regardless of the
        // global CSS setting.
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [pathname]);

    return null;
};

export default ScrollToTop;
