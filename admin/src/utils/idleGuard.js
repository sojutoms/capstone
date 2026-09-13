let activeCount = 0;

export const isIdleGuardActive = () => activeCount > 0;

export const pauseIdleTimeout = () => {
  activeCount++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeCount = Math.max(0, activeCount - 1);
  };
};
