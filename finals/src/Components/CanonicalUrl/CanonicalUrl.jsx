import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_ORIGIN = "https://goodsolesph.online";

const CanonicalUrl = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        const href = pathname === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${pathname}`;
        let link = document.querySelector('link[rel="canonical"]');
        if (!link) {
            link = document.createElement("link");
            link.setAttribute("rel", "canonical");
            document.head.appendChild(link);
        }
        link.setAttribute("href", href);

        const ogUrl = document.querySelector('meta[property="og:url"]');
        if (ogUrl) ogUrl.setAttribute("content", href);
    }, [pathname]);

    return null;
};

export default CanonicalUrl;
