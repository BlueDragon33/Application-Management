/** Defer browser-owned state updates until after effects subscribe, and cancel stale setups. */
export function scheduleClientInitialization(initialize: () => void): () => void {
  let cancelled = false;
  queueMicrotask(() => {
    if (!cancelled) initialize();
  });
  return () => { cancelled = true; };
}
