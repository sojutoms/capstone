import React, { useContext } from "react";
import { ShopContext } from "../../Context/ShopContext";

const SIMPLE_CATEGORIES = ["bags", "collectibles"];

const CartTotal = ({
  paymentMethod,
  discountAmount = 0,
  discountPercent = 0,
  voucherCode = null,
  shippingFee = 0,
  shippingTierLabel = "",
  shippingEta = "",
  codFee = 0,
}) => {
  const { all_product, cartItems } = useContext(ShopContext);

  const formatPrice = (price) => {
    const num = Number(price);
    if (!Number.isFinite(num)) return "0.00";
    return num.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getSizePrice = (product, sizeToken) => {
    if (!product) return 0;

    const category = String(product.category || "").toLowerCase();
    const isSimple = SIMPLE_CATEGORIES.includes(category);
    const normalizedSize = sizeToken === "null" || sizeToken === "undefined" ? "" : (sizeToken || "");

    if (isSimple) {
      const top = product.price ?? product.new_price ?? product.price_php ?? product.new_price_php ?? product.amount ?? product.value;
      const n = Number(top);
      return Number.isFinite(n) ? n : 0;
    }

    const sizeData = product.sizes?.[normalizedSize];
    if (sizeData !== undefined && sizeData !== null) {
      if (typeof sizeData === "object") {
        const p = sizeData.price ?? sizeData.amount ?? sizeData.value;
        const n = Number(p);
        if (Number.isFinite(n) && n > 0) return n;
      } else {
        const n = Number(sizeData);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }

    const fallback = product.new_price ?? product.price ?? product.price_php ?? product.amount ?? product.value;
    const nf = Number(fallback);
    return Number.isFinite(nf) ? nf : 0;
  };

  const calculateCartTotal = () => {
    let total = 0;
    for (const [key, quantity] of Object.entries(cartItems)) {
      if (!quantity || quantity <= 0) continue;
      const [productId, sizeToken] = key.split("_");
      const product = all_product.find((p) => p.id === Number(productId));
      if (!product) continue;
      const normalizedSize = sizeToken === "null" || sizeToken === "undefined" ? "" : sizeToken;
      const price = getSizePrice(product, normalizedSize);
      total += (Number(price) || 0) * quantity;
    }
    return total;
  };

  const getDeliveryDateRange = () => {
    const today = new Date();
    // Parse eta string like "2–3 business days" to get min/max days
    let minDays = 3;
    let maxDays = 6;

    if (shippingEta) {
      const match = shippingEta.match(/(\d+)[–-](\d+)/);
      if (match) {
        minDays = parseInt(match[1], 10);
        maxDays = parseInt(match[2], 10);
      }
    }

    const addBusinessDays = (date, days) => {
      const d = new Date(date);
      let added = 0;
      while (added < days) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() !== 0 && d.getDay() !== 6) added++;
      }
      return d;
    };

    const startDate = addBusinessDays(today, minDays);
    const endDate = addBusinessDays(today, maxDays);

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatDate = (date) =>
      `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;

    return `${formatDate(startDate)} – ${formatDate(endDate)}`;
  };

  const subtotal = calculateCartTotal();
  const shipping = Number(shippingFee) || 0;
  const cod = Number(codFee) || 0;
  const discount = Number(discountAmount) || 0;
  const total = subtotal + shipping + cod - discount;

  const isFreeShipping = shipping === 0;
  const hasRegion = shippingTierLabel !== "";

  return (
    <div style={{
      position: "sticky",
      top: "20px",
      background: "linear-gradient(180deg, #151515 0%, #0a0a0a 100%)",
      padding: "30px",
      borderRadius: "16px",
      border: "1px solid rgba(255,255,255,0.08)",
      maxHeight: "calc(100vh - 40px)",
      overflowY: "auto",
      color: "#ffffff",
      boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
    }}>
      <h2 style={{
        fontSize: "22px",
        fontWeight: "800",
        marginBottom: "24px",
        color: "#ffffff",
        textTransform: "uppercase",
        letterSpacing: "-0.5px",
        fontFamily: "'Bebas Neue', sans-serif"
      }}>
        Order Summary
      </h2>

      {/* Subtotal */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", fontSize: "16px", color: "#ffffff", fontWeight: "700" }}>
        <span style={{ color: "#777777", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" }}>Subtotal</span>
        <span>₱{formatPrice(subtotal)}</span>
      </div>

      {/* Shipping fee row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", fontSize: "16px", color: "#ffffff", fontWeight: "700" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ color: "#777777", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" }}>
            Delivery / Shipping
          </span>
          {hasRegion && (
            <span style={{ fontSize: "11px", color: "#666", fontWeight: "500", textTransform: "none", letterSpacing: "0" }}>
              {shippingTierLabel}
              {shippingEta ? ` · ${shippingEta}` : ""}
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
          {!hasRegion ? (
            <span style={{ color: "#666", fontSize: "12px", fontWeight: "600" }}>Select region</span>
          ) : isFreeShipping ? (
            <span style={{
              background: "linear-gradient(135deg, #ffffff, #f0f0f0)",
              color: "#050505",
              fontSize: "11px",
              fontWeight: "800",
              padding: "2px 8px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              borderRadius: "4px"
            }}>
              FREE
            </span>
          ) : (
            <span>₱{formatPrice(shipping)}</span>
          )}
        </div>
      </div>

      {/* COD fee row */}
      {paymentMethod === "cash on delivery" && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", fontSize: "16px", color: "#ffffff", fontWeight: "700" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ color: "#777777", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" }}>
              COD Handling Fee
            </span>
            {hasRegion && (
              <span style={{ fontSize: "11px", color: "#666", fontWeight: "500" }}>
                {shippingTierLabel}
              </span>
            )}
          </div>
          <span>₱{formatPrice(cod)}</span>
        </div>
      )}

      {/* Voucher discount row */}
      {voucherCode && discount > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", fontSize: "16px", color: "#ffffff", fontWeight: "700" }}>
          <span style={{ color: "#777777", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" }}>
            Voucher ({discountPercent}% off)
          </span>
          <span style={{ color: "#4ade80" }}>−₱{formatPrice(discount)}</span>
        </div>
      )}

      {/* Free shipping progress bar — only show if NOT already free */}
      {!isFreeShipping && hasRegion && (
        <div style={{ margin: "16px 0" }}>
          <p style={{ fontSize: "12px", color: "#ffffff", marginBottom: "8px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>
            Shipping: ₱{formatPrice(shipping)} for {shippingTierLabel}
          </p>
        </div>
      )}

      {isFreeShipping && hasRegion && (
        <div style={{ margin: "16px 0" }}>
          <p style={{ fontSize: "12px", color: "#ffffff", marginBottom: "8px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px" }}>
            {subtotal >= 5000 ? "Complimentary shipping unlocked." : `Complimentary shipping to ${shippingTierLabel}`}
          </p>
          <div style={{ width: "100%", height: "12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", overflow: "hidden" }}>
            <div style={{ width: "100%", height: "100%", background: "linear-gradient(90deg, #ffffff, #f0f0f0)", borderRadius: "6px" }}></div>
          </div>
        </div>
      )}

      {/* No region selected placeholder */}
      {!hasRegion && (
        <div style={{ margin: "16px 0", padding: "12px", border: "1px dashed rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
          <p style={{ fontSize: "12px", color: "#ffffff", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", margin: 0, textAlign: "center" }}>
            📍 Select a region to see shipping cost
          </p>
        </div>
      )}

      {/* Total */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontWeight: "800",
        fontSize: "20px",
        marginTop: "20px",
        paddingTop: "20px",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        color: "#ffffff",
        textTransform: "uppercase"
      }}>
        <span>Total</span>
        <span>₱{formatPrice(total)}</span>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "20px 0" }} />

      {/* Estimated delivery */}
      <div style={{ marginBottom: "20px" }}>
        <p style={{ fontSize: "14px", color: "#ffffff", fontWeight: "800", textTransform: "uppercase" }}>
          Arrives {getDeliveryDateRange()}
        </p>
        {hasRegion && (
          <p style={{ fontSize: "11px", color: "#777", fontWeight: "600", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {shippingTierLabel} · {shippingEta}
          </p>
        )}
      </div>

      {/* Cart items list */}
      <div style={{ marginTop: "20px" }}>
        {Object.entries(cartItems).map(([key, quantity]) => {
          const [productId, sizeToken] = key.split("_");
          const product = all_product.find((p) => p.id === Number(productId));
          if (!product || quantity <= 0) return null;

          const normalizedSize = sizeToken === "null" || sizeToken === "undefined" ? "" : sizeToken;
          const sizePrice = getSizePrice(product, normalizedSize);
          const showSize = !SIMPLE_CATEGORIES.includes(String(product.category || "").toLowerCase());

          return (
            <div key={key} style={{
              display: "flex",
              gap: "15px",
              marginBottom: "20px",
              paddingBottom: "20px",
              borderBottom: "1px solid rgba(255,255,255,0.08)"
            }}>
              <img
                src={product.image}
                alt={product.name}
                style={{
                  width: "80px",
                  height: "80px",
                  objectFit: "contain",
                  background: "rgba(255,255,255,0.04)",
                  padding: "5px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  flexShrink: 0
                }}
              />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <p style={{ fontSize: "14px", fontWeight: "800", color: "#ffffff", marginBottom: "4px", textTransform: "uppercase" }}>
                  {product.name}
                </p>
                <p style={{ fontSize: "11px", color: "#777777", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700" }}>
                  Qty {quantity}
                </p>
                {showSize && (
                  <p style={{ fontSize: "11px", color: "#777777", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700" }}>
                    Size {normalizedSize || "—"}
                  </p>
                )}
                <p style={{ fontSize: "14px", fontWeight: "800", color: "#ffffff", marginTop: "6px" }}>
                  ₱{formatPrice(sizePrice)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CartTotal;
