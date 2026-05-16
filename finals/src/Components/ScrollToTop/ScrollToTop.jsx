import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        // Instant scroll to top - not smooth, to avoid any scroll position issues
        window.scrollTo(0, 0);
        // Also reset any saved scroll positions
        if (document.documentElement) {
            document.documentElement.scrollTop = 0;
        }
        if (document.body) {
            document.body.scrollTop = 0;
        }
    }, [pathname]);

    return null;
};

export default ScrollToTop;
