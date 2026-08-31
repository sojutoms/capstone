// shippingFee.js — Shared shipping fee utility
// Store is based in Metro Manila (NCR). Fees increase by distance.

/**
 * PSGC Region Code → Shipping Tier
 *
 * Tier 0 — Metro Manila (NCR):         ₱0    (free)
 * Tier 1 — Nearby (III, IV-A):         ₱150
 * Tier 2 — Rest of Luzon (I,II,IV-B,V,CAR,MIMAROPA): ₱220
 * Tier 3 — Visayas (VI, VII, VIII):    ₱300
 * Tier 4 — Mindanao (IX–XIII, BARMM):  ₱380
 */

export const SHIPPING_TIERS = {
  0: { label: "Metro Manila",        fee: 0,   eta: "1–2 business days" },
  1: { label: "Nearby Luzon",        fee: 150, eta: "2–3 business days" },
  2: { label: "Rest of Luzon",       fee: 220, eta: "3–5 business days" },
  3: { label: "Visayas",             fee: 300, eta: "4–6 business days" },
  4: { label: "Mindanao / Remote",   fee: 380, eta: "5–8 business days" },
};

/** Map of PSGC region code → tier index */
const REGION_TIER_MAP = {
  // Tier 0 — NCR
  "1300000000": 0,

  // Tier 1 — Nearby Luzon
  "0300000000": 1, // Region III  - Central Luzon
  "0400000000": 1, // Region IV-A - CALABARZON

  // Tier 2 — Rest of Luzon
  "0100000000": 2, // Region I    - Ilocos
  "0200000000": 2, // Region II   - Cagayan Valley
  "1400000000": 2, // CAR
  "1700000000": 2, // MIMAROPA (Region IV-B)
  "0500000000": 2, // Region V    - Bicol

  // Tier 3 — Visayas
  "0600000000": 3, // Region VI   - Western Visayas
  "0700000000": 3, // Region VII  - Central Visayas
  "0800000000": 3, // Region VIII - Eastern Visayas

  // Tier 4 — Mindanao
  "0900000000": 4, // Region IX   - Zamboanga Peninsula
  "1000000000": 4, // Region X    - Northern Mindanao
  "1100000000": 4, // Region XI   - Davao
  "1200000000": 4, // Region XII  - SOCCSKSARGEN
  "1600000000": 4, // Region XIII - Caraga
  "1500000000": 4, // BARMM
};

/**
 * Returns the shipping tier object for a given PSGC region code.
 * Falls back to tier 2 (Rest of Luzon) for unknown codes.
 */
export const getShippingTier = (regionCode) => {
  if (!regionCode) return null;
  const tier = REGION_TIER_MAP[String(regionCode)] ?? 2;
  return { ...SHIPPING_TIERS[tier], tier };
};

/**
 * Returns just the shipping fee (number) for a region code.
 * Returns 0 if no region selected yet. Purely region-tier based (NCR is
 * "free" because its own tier fee is 0, not because of order size).
 */
export const getShippingFee = (regionCode) => {
  if (!regionCode) return 0;
  const tierObj = getShippingTier(regionCode);
  return tierObj ? tierObj.fee : 0;
};

export default { SHIPPING_TIERS, getShippingTier, getShippingFee };
