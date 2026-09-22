import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Static assets and the file/job routes do their own thing; everything else refreshes the session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/files|api/jobs|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
