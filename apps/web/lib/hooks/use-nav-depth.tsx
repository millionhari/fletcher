"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const KEY = "fletcher:nav-depth";

/** Counts in-app navigations for this tab so Back knows whether there is somewhere to go back to. */
export function NavDepthTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    try {
      const n = Number(sessionStorage.getItem(KEY) ?? "0");
      sessionStorage.setItem(KEY, String(n + 1));
    } catch {}
  }, [pathname]);
  return null;
}

/** Go back in history when the previous entry is ours; otherwise go to the fallback route. */
export function useBack(fallback: string) {
  const router = useRouter();
  return useCallback(() => {
    let depth = 0;
    try {
      depth = Number(sessionStorage.getItem(KEY) ?? "0");
    } catch {}
    if (depth > 1 && window.history.length > 1) router.back();
    else router.push(fallback);
  }, [router, fallback]);
}
