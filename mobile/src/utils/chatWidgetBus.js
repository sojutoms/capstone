// Cross-screen trigger for ChatWidget's modal — same pub-sub shape as
// flyToCartBus.js. ChatWidget lives once at the navigation root, so a
// screen's own chat icon (e.g. the Home hero) can't call its setOpen
// directly; it publishes an "open" event here instead.
const listeners = new Set();

export function subscribeChatWidget(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function openChatWidget() {
  listeners.forEach((fn) => fn());
}
