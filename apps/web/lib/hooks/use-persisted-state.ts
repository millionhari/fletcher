"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * useState that mirrors to localStorage. Reads after mount so SSR markup matches,
 * and tolerates private mode / blocked storage.
 */
export function usePersistedState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {}
    setHydrated(true);
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch {}
        return resolved;
      });
    },
    [key],
  );

  return [value, set, hydrated];
}
