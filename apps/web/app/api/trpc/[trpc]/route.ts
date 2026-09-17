import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@fletcher/api";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      if (process.env.NODE_ENV !== "production") console.error(`tRPC ${path ?? "?"}:`, error.message);
    },
  });

export { handler as GET, handler as POST };
