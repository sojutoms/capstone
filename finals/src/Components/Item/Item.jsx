import React from "react";
import PropTypes from "prop-types";
import "./Item.css";
import { Link, useNavigate } from "react-router-dom";

/* Safe primitive -> number conversion */
const toNumber = (v) => {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "object") return NaN;
  if (typeof v === "string") return Number(v.replace(/[, ]+/g, ""));
  return Number(v);
};

const PRICE_KEYS = ["price", "amount", "retail_price", "value", "new_price", "price_php", "php", "p"];
const QTY_KEYS = ["quantity", "qty", "stock", "available", "inventory"];

const findPriceInEntry = (entry) => {
  if (entry === null || entry === undefined) return NaN;
  if (typeof entry === "number" || typeof entry === "string") {
    const n = toNumber(entry);
    return Number.isFinite(n) ? n : NaN;
  }
  if (Array.isArray(entry)) {
    for (const it of entry) {
      const p = findPriceInEntry(it);
      if (Number.isFinite(p)) return p;
    }
    return NaN;
  }
  for (const k of PRICE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(entry, k)) {
      const p = toNumber(entry[k]);
      if (Number.isFinite(p)) return p;
    }
  }
  for (const val of Object.values(entry)) {
    const p = findPriceInEntry(val);
    if (Number.isFinite(p)) return p;
  }
  return NaN;
};

const isAvailableEntry = (entry) => {
  if (entry === null || entry === undefined) return false;
  if (typeof entry !== "object") return true;
  for (const k of QTY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(entry, k)) {
      const q = toNumber(entry[k]);
      return Number.isFinite(q) && q > 0;
    }
  }
  return true;
};

const gatherPricesFromSizes = (sizes) => {
  if (!sizes || typeof sizes !== "object") return [];
  const prices = [];
  Object.values(sizes).forEach((entry) => {
    if (!isAvailableEntry(entry)) return;
    const p = findPriceInEntry(entry);
    if (Number.isFinite(p) && p > 0) prices.push(p);
  });
  return prices;
};

const gatherFallbackPrices = (props) => {
  const candidates = [];
  if (props.new_price !== undefined) {
    const p = findPriceInEntry(props.new_price);
    if (Number.isFinite(p)) candidates.push(p);
  }
  if (props.price !== undefined) {
    const p = findPriceInEntry(props.price);
    if (Number.isFinite(p)) candidates.push(p);
  }
  const altKeys = ["price_map", "variants", "prices", "priceList"];
  for (const k of altKeys) {
    if (props[k] !== undefined) {
      const p = findPriceInEntry(props[k]);
      if (Number.isFinite(p)) candidates.push(p);
    }
  }
  return candidates;
};

const formatPriceNumber = (num) => {
  if (!Number.isFinite(num) || num <= 0) return null;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(num);
};

const Item = (props) => {
  const sizePrices = gatherPricesFromSizes(props.sizes);
  const fallbackPrices = gatherFallbackPrices(props);
  const allPrices = sizePrices.length > 0 ? sizePrices : fallbackPrices;
  const uniquePrices = Array.from(new Set(allPrices)).sort((a, b) => a - b);

  const lowest = uniquePrices.length > 0 ? uniquePrices[0] : NaN;
  const formattedLowest = formatPriceNumber(lowest);

  const [isHovered, setIsHovered] = React.useState(false);
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 });
  const navigate = useNavigate();

  const handleMouseMove = (e) => {
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - left) / width - 0.5;
    const y = (e.clientY - top) / height - 0.5;
    setTilt({ x: x * 15, y: y * -15 });

    const shineX = (e.clientX - left) / width * 100;
    const shineY = (e.clientY - top) / height * 100;
    e.currentTarget.style.setProperty('--shine-x', `${shineX}%`);
    e.currentTarget.style.setProperty('--shine-y', `${shineY}%`);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  };

  const handleSizeClick = (e, size) => {
    e.preventDefault();
    e.stopPropagation();
    window.scrollTo(0, 0);
    navigate(`/product/${props.id}`, { state: { initialSize: size } });
  };

  return (
    <div 
      className={`item ${isHovered ? 'is-hovered' : ''}`} 
      aria-label={props.name || "product"}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: isHovered 
          ? `perspective(1000px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) translateY(-10px)` 
          : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)'
      }}
    >
      <Link
        to={`/product/${props.id}`}
        className="item-link"
        onClick={() => window.scrollTo(0, 0)}
      >
        {/* ── Image ── */}
        <div className="item-image-wrapper">
          {props.isNew && <span className="new-badge">New</span>}
          {!props.isNew && props.isJustIn && (
            <span className="just-in-badge">Just In</span>
          )}
          {!props.isNew && !props.isJustIn && props.isTopSellerInBrand && (
            <span className="bestseller-badge">Best Seller</span>
          )}
          
          {/* Badges removed to reduce clutter as per user feedback */}

          <img
            src={(isHovered && props.subImages && props.subImages.length > 0) ? props.subImages[0] : props.image}
            alt={props.name || "product image"}
            className={`item-image ${isHovered && props.subImages?.length > 0 ? 'item-image--alt' : ''}`}
            style={{
              transform: isHovered ? 'scale(1.15) translateY(-15px) translateZ(50px)' : 'scale(1) translateY(0) translateZ(0)',
              transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              filter: isHovered ? 'drop-shadow(0 20px 40px rgba(0,0,0,0.5))' : 'none'
            }}
          />

          {/* Quick Size Overlay - Only show if multiple sizes are available */}
          {((Array.isArray(props.sizes) && props.sizes.filter(s => s.quantity > 0).length > 0) || 
            (props.sizes && typeof props.sizes === 'object' && Object.keys(props.sizes).length > 0)) && (
            <div className="item-size-overlay">
              <div className="size-overlay-inner">
                <span className="size-overlay-title">Select Size</span>
                <div className="size-list-mini">
                  {Array.isArray(props.sizes) ? (
                    props.sizes.filter(s => s.quantity > 0).slice(0, 5).map((s, idx) => (
                      <span 
                        key={idx} 
                        className="mini-size-item"
                        onClick={(e) => handleSizeClick(e, s.size)}
                      >
                        {s.size}
                      </span>
                    ))
                  ) : props.sizes && typeof props.sizes === 'object' ? (
                    Object.entries(props.sizes).filter(([_, v]) => (typeof v === 'object' ? v.quantity : v) > 0).slice(0, 5).map(([k], idx) => (
                      <span 
                        key={idx} 
                        className="mini-size-item"
                        onClick={(e) => handleSizeClick(e, k)}
                      >
                        {k}
                      </span>
                    ))
                  ) : null}
                  {((Array.isArray(props.sizes) ? props.sizes.filter(s => s.quantity > 0).length : Object.keys(props.sizes || {}).length) > 5) && (
                    <span className="mini-size-item mini-size-more">+</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Info ── */}
        <div className="item-info">
          <p className="item-name">{props.name}</p>
          <div className="item-prices">
            <div className="item-price-new">
              {formattedLowest ? (
                formattedLowest
              ) : (
                <span className="price-unavailable">Price unavailable</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

Item.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  name: PropTypes.string,
  image: PropTypes.string,
  sizes: PropTypes.object,
  new_price: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object]),
  price: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object]),
  isNew: PropTypes.bool,
  isJustIn: PropTypes.bool,
  isTopSellerInBrand: PropTypes.bool,
};

Item.defaultProps = {
  name: "",
  image: "",
  sizes: {},
  new_price: undefined,
  price: undefined,
  isNew: false,
  isJustIn: false,
  isTopSellerInBrand: false,
};

export default Item;
