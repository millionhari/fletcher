"use client";

import { createContext, useContext, type ReactNode } from "react";

const Ctx = createContext<string | null>(null);

export function ProjectIdProvider({ id, children }: { id: string; children: ReactNode }) {
  return <Ctx.Provider value={id}>{children}</Ctx.Provider>;
}

export function useProjectId(): string {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProjectId outside ProjectIdProvider");
  return v;
}
