import React, { useEffect } from "react";
import "./SocialFeed.css";

const FB_PAGE_URL = "https://www.facebook.com/goodsoles.ph";
const IG_PROFILE = "https://www.instagram.com/goodsolesph/?hl=en";

const loadFacebookSdk = () => {
  if (!document.getElementById("fb-root")) {
    const root = document.createElement("div");
    root.id = "fb-root";
    document.body.appendChild(root);
  }
  if (window.FB) {
    window.FB.XFBML.parse();
    return;
  }
  if (document.getElementById("facebook-jssdk")) return;
  const script = document.createElement("script");
  script.id = "facebook-jssdk";
  script.src = "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v19.0";
  script.async = true;
  script.defer = true;
  script.crossOrigin = "anonymous";
  document.body.appendChild(script);
};

const FacebookFeed = () => {
  useEffect(() => {
    loadFacebookSdk();
  }, []);

  return (
    <div className="sf-panel">
      <div className="sf-panel__header">
        <div className="sf-panel__brand">
          <div className="sf-panel__avatar">G</div>
          <div>
            <div className="sf-panel__name">GoodSoles PH</div>
            <div className="sf-panel__handle">@goodsoles.ph</div>
          </div>
        </div>
        <a href={FB_PAGE_URL} target="_blank" rel="noopener noreferrer" className="sf-panel__badge sf-panel__badge--fb">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#1877f2">
            <path d="M24 12.07C24 5.44 18.63 0 12 0S0 5.44 0 12.07c0 5.99 4.39 10.95 10.13 11.85v-8.39H7.08v-3.47h3.05V9.43c0-3 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.52c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.47h-2.8v8.39C19.61 23.02 24 18.06 24 12.07z" />
          </svg>
          Follow
        </a>
      </div>

      <div className="sf-panel__body sf-panel__body--fb">
        <div
          className="fb-page"
          data-href={FB_PAGE_URL}
          data-tabs="timeline"
          data-height="600"
          data-small-header="false"
          data-adapt-container-width="true"
          data-hide-cover="false"
          data-show-facepile="true"
        >
          <blockquote cite={FB_PAGE_URL} className="fb-xfbml-parse-ignore">
            <a href={FB_PAGE_URL}>GoodSoles PH</a>
          </blockquote>
        </div>
      </div>
    </div>
  );
};

const InstagramFeed = () => (
  <div className="sf-panel">
    <div className="sf-panel__header">
      <div className="sf-panel__brand">
        <div className="sf-panel__avatar sf-panel__avatar--ig">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="0.8" fill="#fff" stroke="none" />
          </svg>
        </div>
        <div>
          <div className="sf-panel__name">GoodSoles PH</div>
          <div className="sf-panel__handle">@goodsolesph</div>
        </div>
      </div>
      <a href={IG_PROFILE} target="_blank" rel="noopener noreferrer" className="sf-panel__badge sf-panel__badge--ig">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e1306c" strokeWidth="2">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="#e1306c" stroke="none" />
        </svg>
        Follow
      </a>
    </div>

    <div className="sf-panel__body sf-panel__body--ig">
      <iframe
        src="https://www.instagram.com/goodsolesph/embed"
        title="GoodSoles PH Instagram"
        className="sf-panel__ig-iframe"
        frameBorder="0"
        scrolling="yes"
        allowtransparency="true"
        allow="encrypted-media"
      />
      <div className="sf-panel__ig-footer">
        <a href={IG_PROFILE} target="_blank" rel="noopener noreferrer" className="sf-panel__ig-link">
          View all posts on Instagram
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  </div>
);

const SocialFeed = () => (
  <div className="social-feed">
    <FacebookFeed />
    <InstagramFeed />
  </div>
);

export default SocialFeed;
