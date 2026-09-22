"use client";

import Link from "next/link";
import { ChevronsUpDown, LogOut, Plug } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MemberAvatar } from "@/components/fletcher/member-avatar";

/** Sidebar footer: who you are, and the way out. */
export function UserMenu({ name, email, avatarUrl, devSession }: { name: string; email: string; avatarUrl?: string | null; devSession: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent">
          <MemberAvatar name={name} avatarUrl={avatarUrl} size="sm" showTooltip={false} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">{name}</span>
            <span className="block truncate text-2xs text-muted-foreground">{devSession ? "Dev session" : email}</span>
          </span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-xs font-medium">{name}</span>
          <span className="block truncate text-2xs text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/account/connections"><Plug className="text-muted-foreground" />Connections</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={devSession} onClick={() => signOut()}><LogOut className="text-muted-foreground" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
