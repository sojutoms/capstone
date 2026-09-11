// theme.js — GoodSoles PH design system, ported 1:1 from the web app's
// finals/src/index.css. This is the single source of truth for mobile
// styling; screens should pull values from here instead of hardcoding
// their own colors/spacing/radii so the whole app stays visually
// consistent with web and with itself.
//
// Web uses CSS variables that can be re-themed (light/dark); mobile has no
// theme switcher yet, so this ports the LIGHT palette (web's --theme='light'
// values), with the brand accent swapped from gold to black — gold read
// well against the old dark background, but black reads as the stronger
// accent against white.

export const colors = {
  // Backgrounds
  bgPrimary: "#ffffff",
  bgSecondary: "#f8f8f8",
  bgSurface: "#ffffff",
  bgElevated: "#f4f4f4",
  bgCard: "#ffffff",
  bgTertiary: "#eeeeee",

  // Text
  textPrimary: "#111111",
  textSecondary: "#444444",
  textTertiary: "#777777",
  textMuted: "#666666",
  textInverse: "#ffffff",

  // Accent (brand — black, replacing gold now that the background is white)
  accentGold: "#000000",
  accentGoldLight: "#333333",
  accentGoldWash: "rgba(0, 0, 0, 0.08)",

  // Borders / glass
  borderSubtle: "rgba(0, 0, 0, 0.08)",
  borderLight: "rgba(0, 0, 0, 0.15)",
  glassBg: "rgba(0, 0, 0, 0.03)",
  glassBorder: "rgba(0, 0, 0, 0.08)",
  glassBgHover: "rgba(0, 0, 0, 0.06)",
  glassBorderHover: "rgba(0, 0, 0, 0.2)",

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
