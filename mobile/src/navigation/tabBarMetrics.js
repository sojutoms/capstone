import { Platform } from "react-native";

// The floating pill nav is position:absolute (overlays screen content
// instead of reserving its own layout space) so it can show real content
// scrolling behind its transparent margins. That means every screen
// reachable while the tab bar is visible needs to pad its own bottom
// content by at least this much, or the pill will sit on top of/hide
// whatever's at the very bottom (list items, sticky action bars, etc).
// Matches the bar's own paddingTop(10) + pill height(60) +
// platform bottom inset, plus a little breathing room above it.
export const TAB_BAR_CLEARANCE = Platform.OS === "ios" ? 116 : 100;
