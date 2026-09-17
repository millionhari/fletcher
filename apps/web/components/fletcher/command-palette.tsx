"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, FolderKanban, Images, LayoutGrid, LayoutTemplate, Plus, Users } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { SidebarProject } from "@/components/fletcher/sidebar";

export function CommandPalette({ open, onOpenChange, base, projects }: { open: boolean; onOpenChange: (o: boolean) => void; base: string; projects: SidebarProject[] }) {
  const router = useRouter();
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command className="[&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
          <CommandInput placeholder="Jump to a project or page…" />
          <CommandList>
            <CommandEmpty>Nothing found.</CommandEmpty>
            <CommandGroup heading="Projects">
              {projects.map((p) => (
                <CommandItem key={p.id} value={`${p.name} ${p.type}`} onSelect={() => go(`${base}/projects/${p.id}`)}>
                  <span className="size-2 rounded-[3px]" style={{ background: p.color }} />
                  {p.name}
                </CommandItem>
              ))}
              <CommandItem onSelect={() => go(`${base}/projects/new`)}><Plus />New project</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Pages">
              <CommandItem onSelect={() => go(base)}><LayoutGrid />Overview</CommandItem>
              <CommandItem onSelect={() => go(`${base}/projects`)}><FolderKanban />Projects</CommandItem>
              <CommandItem onSelect={() => go(`${base}/calendar`)}><CalendarDays />Calendar</CommandItem>
              <CommandItem onSelect={() => go(`${base}/assets`)}><Images />Profile kit</CommandItem>
              <CommandItem onSelect={() => go(`${base}/team`)}><Users />Team</CommandItem>
              <CommandItem onSelect={() => go(`${base}/templates`)}><LayoutTemplate />Templates</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
