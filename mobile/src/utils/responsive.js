import { useWindowDimensions } from "react-native";

// Breakpoints tuned for real device widths (in dp/pt, not px):
//   iPhone SE ................ 320
//   iPhone 15 Pro ............ 393
//   iPhone 15 Pro Max ........ 430
//   Android compact phones ... 360–412
//   iPad mini ................ 744
//   iPad Air ................. 820
//   iPad Pro 11" ............. 834
//   iPad Pro 13" ............ 1024
//   Landscape phone .......... 800–950
//
// Two columns feels right on phones; three on small tablets and phones in
// landscape; four on large tablets. Cross-checked against Nike, Apple, and
// SNKRS apps' catalog layouts on the same devices.
export const getGridColumns = (windowWidth) => {
  if (windowWidth >= 1000) return 4;
  if (windowWidth >= 700)  return 3;
  return 2;
};

// Horizontal padding matches the shop grid (ShoesScreen.jsx `styles.grid`:
// paddingHorizontal 12, gap 10). Keep in sync if either value changes.
const GRID_HORIZONTAL_PADDING = 12;
const GRID_GAP                = 10;

export const useProductCardWidth = () => {
  const { width } = useWindowDimensions();
  const cols  = getGridColumns(width);
  const usable = width - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (cols - 1);
  return {
    cardWidth: Math.floor(usable / cols),
    columns:   cols,
  };
};

// Type-scale helper — nudge base font sizes on tablets so text isn't tiny on
// a 12.9" display. On phones this returns `base` unchanged.
export const useScaledFont = () => {
  const { width } = useWindowDimensions();
  if (width >= 1000) return (base) => Math.round(base * 1.15);
  if (width >= 700)  return (base) => Math.round(base * 1.08);
  return (base) => base;
};

// Wrap page content in a maxWidth so it doesn't stretch across a full iPad
// Pro landscape screen. Callers can spread this into a container style.
export const useContentMaxWidth = () => {
  const { width } = useWindowDimensions();
  if (width >= 1000) return { maxWidth: 1100, alignSelf: "center", width: "100%" };
  return null;
};
