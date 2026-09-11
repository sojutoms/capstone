// Cross-screen trigger for ChatWidget's modal — same pub-sub shape as
// flyToCartBus.js. ChatWidget lives once at the navigation root, so a
// screen's own chat icon (e.g. the Home header) can't call its setOpen
// directly; it publishes an "open" event here instead. An optional
// `origin` ({x, y} screen coordinates, e.g. from measureInWindow) lets the
// caller's own icon position drive ChatWidget's pop-out animation, since
// that icon isn't the shared FAB ChatWidget can measure itself.
const listeners = new Set();

export function subscribeChatWidget(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function openChatWidget(origin) {
  listeners.forEach((fn) => fn(origin));
}
