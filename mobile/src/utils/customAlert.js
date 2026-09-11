import { publishAlert } from "./alertBus";

// Drop-in replacement for React Native's Alert — same call signature
// (title, message, buttons, options) — so every existing call site keeps
// calling `Alert.alert(...)` unchanged; only the import source moves from
// 'react-native' to here. Renders as the app's own styled modal (AlertHost,
// mounted once at the navigation root) instead of the native OS dialog,
// which looked out of place against the rest of the app's design.
export const Alert = {
  alert(title, message, buttons, options) {
    publishAlert({ title, message, buttons, options });
  },
};
