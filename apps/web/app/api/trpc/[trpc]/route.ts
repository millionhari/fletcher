import { after } from "next/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@fletcher/api";
import { getAuthUser } from "@/lib/auth/session";

// Imports kicked off via after() run inside this function's lifetime.
export const maxDuration = 300;

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => createContext({ auth: await getAuthUser(), enqueue: (fn) => after(fn) }),
    onError({ error, path }) {
      // Always log server-side; the browser only ever sees the message. The
      // cause is where a database or storage failure explains itself.
      const cause = error.cause instanceof Error ? ` ← ${error.cause.message}` : "";
      console.error(`tRPC ${path ?? "?"} [${error.code}]: ${error.message}${cause}`);
    },
  });

export { handler as GET, handler as POST };
