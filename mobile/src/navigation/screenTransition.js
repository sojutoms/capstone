// Shared native-stack screenOptions so every stack in the app animates the
// same way. Previously each navigator only set headerShown:false, leaving
// screen pushes on whatever each platform's bare default happened to be
// (a slide on iOS, a more abrupt fade-up on Android) — this makes the
// premium slide-from-right transition consistent everywhere, and gives
// every stack the same swipe-back gesture behavior.
export const stackScreenOptions = {
  headerShown: false,
  animation: "slide_from_right",
  gestureEnabled: true,
};
