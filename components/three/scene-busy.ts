'use client';

import { useSyncExternalStore } from 'react';

// Booting a 3D box compiles its shaders, which holds the page up for a moment. That only shows when something is
// moving at the same time, so heavy work and motion take turns: whoever is booting or fading holds the page "busy",
// and the next boot waits for quiet. No three.js here: the page imports this before three.js has loaded.
let holds = 0;
const listeners = new Set<() => void>();
const changed = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Marks the page busy until the returned function is called (calling it again is harmless) or `timeout` ms pass. */
export function holdBusy(timeout: number) {
  let held = true;
  const release = () => {
    if (!held) return;
    held = false;
    clearTimeout(timer);
    holds--;
    changed();
  };
  const timer = setTimeout(release, timeout);
  holds++;
  changed();
  return release;
}

/** True while a 3D box is booting or fading in. */
export const useBusy = () =>
  useSyncExternalStore(
    subscribe,
    () => holds > 0,
    () => false
  );
