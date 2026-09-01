// theme.js — GoodSoles PH design system, ported 1:1 from the web app's
// finals/src/index.css. This is the single source of truth for mobile
// styling; screens should pull values from here instead of hardcoding
// their own colors/spacing/radii so the whole app stays visually
// consistent with web and with itself.
//
// Web uses CSS variables that can be re-themed (light/dark); mobile has no
// theme switcher yet, so this ports the DARK palette only (web's default —
// "the original look").

export const colors = {
  // Backgrounds
  bgPrimary: "#0a0a0a",
  bgSecondary: "#121212",
  bgSurface: "#1a1a1a",
  bgElevated: "#222222",
  bgCard: "#151515",
  bgTertiary: "#1e1e1e",

  // Text
  textPrimary: "#ffffff",
  textSecondary: "#a0a0a0",
  textTertiary: "#808080",
  textMuted: "#666666",
  textInverse: "#000000",

  // Accent (brand gold)
  accentGold: "#c5a059",
  accentGoldLight: "#e2c28d",
  accentGoldWash: "rgba(197, 160, 89, 0.15)",

  // Borders / glass
  borderSubtle: "rgba(255, 255, 255, 0.08)",
  borderLight: "rgba(255, 255, 255, 0.15)",
  glassBg: "rgba(255, 255, 255, 0.03)",
  glassBorder: "rgba(255, 255, 255, 0.08)",
  glassBgHover: "rgba(255, 255, 255, 0.06)",
  glassBorderHover: "rgba(255, 255, 255, 0.2)",

  // Status
  danger: "#e5484d",
  success: "#4caf50",
  warning: "#ff9800",

  black: "#000000",
  white: "#ffffff",
};

// Web's --shadow-* tokens, translated to RN's shadow* + elevation props.
// Use via spread: style={[styles.card, shadows.md]}
export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 8,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 50,
    elevation: 16,
  },
};

// Web's --space-* scale (4/8px system)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Web's --radius-* scale
export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
};

// Web loads Bebas Neue (display/headings, uppercase + wide tracking),
// Outfit (body), and Playfair Display (serif accents, rarely used). Mobile
// currently only loads Bebas Neue + Outfit — Playfair isn't used anywhere
// in the app's actual screens today, so it's skipped rather than adding a
// third native font family for no visible payoff.
export const fonts = {
  display: "BebasNeue_400Regular",
  // Outfit's variable weights, matched to the closest static cut per name.
  bodyLight: "Outfit_300Light",
  bodyRegular: "Outfit_400Regular",
  bodyMedium: "Outfit_500Medium",
  bodySemibold: "Outfit_600SemiBold",
  bodyBold: "Outfit_700Bold",
  bodyExtrabold: "Outfit_800ExtraBold",
};

// Web's typographic hierarchy (h1..h6 = display font, uppercase, 0.08em
// tracking; body = Outfit). These presets bundle the recurring
// fontFamily/letterSpacing/textTransform combinations so screens don't
// have to repeat them.
export const typography = {
  // True headings only — screen titles, hero copy. Overusing this everywhere
  // is what made the app read as "shouty web page" instead of "premium app."
  display: {
    fontFamily: fonts.display,
    letterSpacing: 1.2, // ~0.08em at typical mobile sizes
    textTransform: "uppercase",
  },
  // Section eyebrows, card labels, badges, tab labels — the small caps text
  // that used to reach for Bebas Neue. Quieter, still structured.
  label: {
    fontFamily: fonts.bodySemibold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  button: {
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 2.4, // ~0.2em
    textTransform: "uppercase",
  },
  body: {
    fontFamily: fonts.bodyRegular,
  },
};

export default { colors, shadows, spacing, radius, fonts, typography };
