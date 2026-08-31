import React, { useEffect, useRef, useState } from "react";
import "./StoreMap.css";

const STORE = {
  name: "GoodSoles PH",
  lat: 14.5861,
  lng: 121.0569,
  address: "Robinsons Galleria, EDSA, Quezon City",
  hours: "Mon–Sun: 10:00 AM – 9:00 PM",
  phone: "+63 917 123 4567",
};

const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z"/>
  </svg>
);

const ExternalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

let leafletLoaded = false;

const StoreMap = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Load Leaflet CSS + JS once
  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    if (leafletLoaded) { setMapReady(true); return; }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => { leafletLoaded = true; setMapReady(true); };
    document.head.appendChild(script);
  }, []);

  // Initialize map once Leaflet is ready and DOM is mounted
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return;

    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current, {
      center: [STORE.lat, STORE.lng],
      zoom: 16,
      zoomControl: true,
      scrollWheelZoom: false,
      dragging: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Custom marker icon
    const customIcon = L.divIcon({
      className: "",
      html: `
        <div style="
          width: 40px; height: 40px;
          background: #111827;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          display: flex; align-items: center; justify-content: center;
        ">
          <div style="
            width: 14px; height: 14px;
            background: #fff;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -44],
    });

    const marker = L.marker([STORE.lat, STORE.lng], { icon: customIcon }).addTo(map);

    marker.bindPopup(`
      <div style="font-family: 'Segoe UI', system-ui, sans-serif; min-width: 160px;">
        <div style="font-weight: 700; font-size: 14px; color: #111827; margin-bottom: 4px;">${STORE.name}</div>
        <div style="font-size: 12px; color: #6b7280; line-height: 1.4;">${STORE.address}</div>
      </div>
    `, { maxWidth: 220 });

    marker.openPopup();
    mapInstanceRef.current = map;
  }, [mapReady]);

  // Resize map when card expands/collapses
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const timer = setTimeout(() => {
      mapInstanceRef.current.invalidateSize();
    }, 320);
    return () => clearTimeout(timer);
  }, [expanded]);

  const openInMaps = () => {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${STORE.lat},${STORE.lng}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div id="store-map" className={`store-map${expanded ? " store-map--expanded" : ""}`}>
      <div className="store-map__header">
        <div className="store-map__title-group">
          <div className="store-map__dot" />
          <div>
            <div className="store-map__title">GoodSoles PH</div>
            <div className="store-map__subtitle">Robinsons Galleria, Quezon City</div>
          </div>
        </div>
        <button className="store-map__expand-btn" onClick={() => setExpanded((e) => !e)} aria-label={expanded ? "Collapse map" : "Expand map"}>
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {/* Map area */}
      <div
        className="store-map__map-container"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {!mapReady && (
          <div className="store-map__loading">
            <div className="store-map__loading-dot" />
            <span>Loading map…</span>
          </div>
        )}
        <div ref={mapRef} className="store-map__map" />
      </div>

      {/* Store info */}
      <div className="store-map__info">
        <div className="store-map__info-row">
          <span className="store-map__info-icon"><PinIcon /></span>
          <span>{STORE.address}</span>
        </div>
        <div className="store-map__info-row">
          <span className="store-map__info-icon"><ClockIcon /></span>
          <span>{STORE.hours}</span>
        </div>
        <div className="store-map__info-row">
          <span className="store-map__info-icon"><PhoneIcon /></span>
          <span>{STORE.phone}</span>
        </div>
      </div>

      <div className="store-map__footer">
        <button className="store-map__directions-btn" onClick={openInMaps}>
          Get directions <ExternalIcon />
        </button>
      </div>
    </div>
  );
};

export default StoreMap;
