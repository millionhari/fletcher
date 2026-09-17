"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface WorkspaceCtx {
  slug: string;
  id: string;
  name: string;
  artistName: string;
  timezone: string;
  memberId: string;
  userName: string;
}

const Ctx = createContext<WorkspaceCtx | null>(null);

export function WorkspaceProvider({ value, children }: { value: WorkspaceCtx; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return v;
}
