// Cross-screen trigger for the custom Alert modal — same pub-sub shape as
// chatWidgetBus.js/flyToCartBus.js. AlertHost lives once at the navigation
// root and renders whatever gets published here.
const listeners = new Set();

export function subscribeAlert(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function publishAlert(config) {
  listeners.forEach((fn) => fn(config));
}
