"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AtSign, CalendarDays, ChevronsUpDown, FolderKanban, HardDrive, Images, LayoutGrid, LayoutTemplate, Moon, Plus, Search, Sun, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/lib/trpc/client";
import { PROJECT_TYPE_LABELS, type ProjectType } from "@fletcher/core";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/fletcher/kbd";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CommandPalette } from "@/components/fletcher/command-palette";
import { UserMenu } from "@/components/fletcher/auth/user-menu";

export interface SidebarProject {
  id: string;
  name: string;
  type: ProjectType;
  color: string;
  anchorDate: string;
  parentProjectId: string | null;
}

export interface SidebarWorkspace {
  slug: string;
  name: string;
  artistName: string;
}

export function Sidebar({ workspace, workspaces, projects, user }: { workspace: SidebarWorkspace; workspaces: SidebarWorkspace[]; projects: SidebarProject[]; user: { name: string; email: string; avatarUrl: string | null; devSession: boolean } }) {
  const pathname = usePathname();
  const base = `/w/${workspace.slug}`;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const trpc = useTRPC();
  // Polled so a tag from a teammate shows up without a reload.
  const unreadMentions = useQuery({ ...trpc.mentions.unreadCount.queryOptions({ workspace: workspace.slug }), refetchInterval: 60_000 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nav = [
    { href: base, label: "Overview", icon: LayoutGrid, exact: true },
    { href: `${base}/projects`, label: "Projects", icon: FolderKanban },
    { href: `${base}/mentions`, label: "Mentions", icon: AtSign, badge: unreadMentions.data ?? 0 },
    { href: `${base}/calendar`, label: "Calendar", icon: CalendarDays },
    { href: `${base}/assets`, label: "Profile kit", icon: Images },
    { href: `${base}/files`, label: "Files", icon: HardDrive },
    { href: `${base}/team`, label: "Team", icon: Users },
    { href: `${base}/templates`, label: "Templates", icon: LayoutTemplate },
  ];

  const roots = projects.filter((p) => !p.parentProjectId);
  const childrenOf = (id: string) => projects.filter((p) => p.parentProjectId === id);

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col self-start border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="px-3 pt-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary font-heading text-[11px] font-bold text-primary-foreground">{workspace.artistName.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold leading-4">{workspace.name}</span>
                <span className="block truncate text-2xs text-muted-foreground">Workspace</span>
              </span>
              <ChevronsUpDown className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {workspaces.map((w) => (
              <DropdownMenuItem key={w.slug} asChild>
                <Link href={`/w/${w.slug}`}>{w.name}</Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/welcome"><Plus className="text-muted-foreground" />Create workspace</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-3 pt-2">
        <button onClick={() => setPaletteOpen(true)} className="flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-background px-2 text-muted-foreground shadow-hairline transition-colors hover:text-foreground">
          <Search className="size-3.5" />
          <span className="flex-1 text-left text-xs">Search…</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>

      <nav className="mt-3 flex flex-col gap-px px-2">
        {nav.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={cn("flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13px] font-medium transition-colors", active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground")}>
              <item.icon className={cn("size-4", active ? "text-foreground" : "text-muted-foreground")} />
              {item.label}
              {!!item.badge && <span className="tabular ml-auto rounded-md bg-brand px-1.5 text-2xs font-semibold leading-4 text-brand-foreground" aria-label={`${item.badge} unread`}>{item.badge}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 flex items-center justify-between px-4">
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Projects</span>
        <Button asChild variant="ghost" size="icon-xs" aria-label="New project">
          <Link href={`${base}/projects/new`}><Plus /></Link>
        </Button>
      </div>
      <div className="scrollbar-thin mt-1 flex-1 overflow-y-auto px-2">
        {roots.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">No projects yet.</p>}
        {roots.map((p) => (
          <div key={p.id}>
            <ProjectLink base={base} project={p} pathname={pathname} />
            {childrenOf(p.id).map((c) => (
              <div key={c.id} className="ml-3 border-l border-border pl-1">
                <ProjectLink base={base} project={c} pathname={pathname} />
                {childrenOf(c.id).map((g) => (
                  <div key={g.id} className="ml-3 border-l border-border pl-1">
                    <ProjectLink base={base} project={g} pathname={pathname} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 border-t border-sidebar-border px-1 py-1.5">
        <div className="min-w-0 flex-1"><UserMenu name={user.name} email={user.email} avatarUrl={user.avatarUrl} devSession={user.devSession} /></div>
        <ThemeToggle />
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} base={base} projects={projects} />
    </aside>
  );
}

function ProjectLink({ base, project, pathname }: { base: string; project: SidebarProject; pathname: string }) {
  const href = `${base}/projects/${project.id}`;
  const active = pathname.startsWith(href);
  return (
    <Link href={href} className={cn("group flex h-7 items-center gap-2 rounded-md px-2 text-[13px] transition-colors", active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60")}>
      <span className="size-2 shrink-0 rounded-[3px]" style={{ background: project.color }} />
      <span className="truncate">{project.name}</span>
      <span className="ml-auto hidden shrink-0 text-2xs text-muted-foreground group-hover:inline">{PROJECT_TYPE_LABELS[project.type].split(" ")[0]}</span>
    </Link>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("fletcher-theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <Button variant="ghost" size="icon-xs" onClick={toggle} aria-label="Toggle theme">
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
