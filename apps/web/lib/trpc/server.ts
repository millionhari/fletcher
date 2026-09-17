import "server-only";
import { cache } from "react";
import { appRouter, createCaller, createContext } from "@fletcher/api";

/** Server-side caller for React Server Components; one context per request. */
export const getServerCaller = cache(async () => {
  const ctx = await createContext();
  return createCaller(ctx);
});

export { appRouter };
