type Listener = (payload: unknown) => void;

const listeners = new Map<string, Set<Listener>>();

export function simulationBusSubscribe(
  simulationId: string,
  listener: Listener,
): () => void {
  let set = listeners.get(simulationId);
  if (!set) {
    set = new Set();
    listeners.set(simulationId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(simulationId);
  };
}

export function simulationBusPublish(simulationId: string, payload: unknown): void {
  const set = listeners.get(simulationId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(payload);
    } catch {
      /* ignore listener errors */
    }
  }
}
