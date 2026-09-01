// Tracks the currently focused route name outside of React Navigation's own
// context tree, for components mounted as siblings of the navigator (e.g.
// ChatWidget) rather than as a registered Screen — those can't use
// useNavigationState/useRoute, since that context is only provided to
// descendants of an actual Navigator, not to siblings of one.
// App.js feeds this from NavigationContainer's onStateChange/onReady.
let currentRouteName = null;
const listeners = new Set();

export function setActiveRouteName(name) {
  currentRouteName = name;
  listeners.forEach((fn) => fn(name));
}

export function getActiveRouteName() {
  return currentRouteName;
}

export function subscribeActiveRoute(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
