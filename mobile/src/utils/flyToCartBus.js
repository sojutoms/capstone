// Tiny pub-sub so any screen (ProductDetail, product cards, etc.) can
// trigger the fly-to-cart animation without needing a shared ref passed
// down through props/context — the overlay that actually renders it lives
// once at the app root (see FlyToCartOverlay), completely outside whichever
// stack/screen the tap happened in.
let listeners = [];

export function onFlyToCart(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((cb) => cb !== callback);
  };
}

// origin: { x, y, width, height } in window coordinates, from measureInWindow()
export function triggerFlyToCart(origin) {
  listeners.forEach((cb) => cb(origin));
}
