let idCounter = 0;
let listeners = [];

export const subscribeToast = (fn) => {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
};

export const showToast = (type, message, duration = 3500) => {
  listeners.forEach((fn) => fn({ id: ++idCounter, type, message, duration }));
};
