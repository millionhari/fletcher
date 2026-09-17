"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MEMBER_ROLES, MEMBER_ROLE_LABELS, PERMISSIONS, type MemberRole, type Permission } from "@fletcher/core";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useMembers } from "@/lib/hooks/use-project-data";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, SectionHeader } from "@/components/fletcher/page-header";
import { MemberAvatar } from "@/components/fletcher/member-avatar";
import { Pill } from "@/components/fletcher/status-badge";

const GROUPS: { title: string; roles: MemberRole[] }[] = [
  { title: "Artist & management", roles: ["artist", "manager", "business_manager", "legal"] },
  { title: "Marketing & socials", roles: ["marketing", "social", "publicist", "web"] },
  { title: "Music", roles: ["producer", "mix_engineer", "mastering_engineer", "label_distributor", "publisher_sync"] },
  { title: "Creative", roles: ["videographer", "photographer"] },
  { title: "Live & commerce", roles: ["booking_agent", "merch"] },
  { title: "Other", roles: ["other"] },
];

export function TeamView() {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const members = useMembers();
  const [open, setOpen] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.members.list.queryKey({ workspace: ws.slug }) });
  const update = useMutation(trpc.members.update.mutationOptions({ onSuccess: invalidate, onError: (e) => toast.error(e.message) }));
  const remove = useMutation(trpc.members.remove.mutationOptions({ onSuccess: async () => { await invalidate(); toast.success("Member removed"); }, onError: (e) => toast.error(e.message) }));

  const list = members.data ?? [];
  return (
    <div className="fade-in-up">
      <PageHeader title="Team" description="Everyone who touches the campaign, internal and external. Roles drive who gets suggested for each task." actions={<Button size="sm" onClick={() => setOpen(true)}><Plus />Add member</Button>} />
      {members.isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="space-y-8">
          {GROUPS.map((g) => {
            const rows = list.filter((m) => g.roles.includes(m.role));
            if (!rows.length) return null;
            return (
              <section key={g.title}>
                <SectionHeader title={g.title} count={rows.length} />
                <div className="surface overflow-hidden">
                  <Table>
                    <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="w-[30%]">Member</TableHead><TableHead>Role</TableHead><TableHead>Title / company</TableHead><TableHead>Access</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                    <TableBody>
                      {rows.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <MemberAvatar name={m.name} size="md" showTooltip={false} />
                              <div className="min-w-0"><div className="truncate font-medium">{m.name} {m.id === ws.memberId && <span className="text-2xs text-muted-foreground">(you)</span>}</div><div className="truncate text-2xs text-muted-foreground">{m.email}</div></div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select value={m.role} onValueChange={(v) => update.mutate({ workspace: ws.slug, memberId: m.id, role: v as MemberRole })}>
                              <SelectTrigger size="sm" className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{MEMBER_ROLES.map((r) => <SelectItem key={r} value={r}>{MEMBER_ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{[m.title, m.company].filter(Boolean).join(" · ") || "—"}{m.isExternal && <Pill tone="neutral" dot={false} className="ml-2">External</Pill>}</TableCell>
                          <TableCell>
                            <Select value={m.permission} onValueChange={(v) => update.mutate({ workspace: ws.slug, memberId: m.id, permission: v as Permission })}>
                              <SelectTrigger size="sm" className="h-7 w-28 text-xs capitalize"><SelectValue /></SelectTrigger>
                              <SelectContent>{PERMISSIONS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>{m.id !== ws.memberId && <Button variant="ghost" size="icon-xs" aria-label="Remove" onClick={() => { if (confirm(`Remove ${m.name}?`)) remove.mutate({ workspace: ws.slug, memberId: m.id }); }}><Trash2 /></Button>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            );
          })}
        </div>
      )}
      <AddMemberDialog open={open} onOpenChange={setOpen} onDone={invalidate} />
    </div>
  );
}

function AddMemberDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => Promise<unknown> }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const [form, setForm] = useState({ name: "", email: "", role: "videographer" as MemberRole, permission: "member" as Permission, title: "", company: "", isExternal: true });
  const add = useMutation(trpc.members.add.mutationOptions({ onSuccess: async () => { await onDone(); onOpenChange(false); setForm({ name: "", email: "", role: "videographer", permission: "member", title: "", company: "", isExternal: true }); toast.success("Member added"); }, onError: (e) => toast.error(e.message) }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add team member</DialogTitle><DialogDescription>Invites and sign-in arrive with auth. For now this creates the member so work can be assigned.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1"><Label>Name</Label><Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid gap-1"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="grid gap-1"><Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as MemberRole })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MEMBER_ROLES.map((r) => <SelectItem key={r} value={r}>{MEMBER_ROLE_LABELS[r]}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid gap-1"><Label>Access</Label>
            <Select value={form.permission} onValueChange={(v) => setForm({ ...form, permission: v as Permission })}><SelectTrigger className="capitalize"><SelectValue /></SelectTrigger><SelectContent>{PERMISSIONS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid gap-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Director / DP" /></div>
          <div className="grid gap-1"><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
          <label className="col-span-2 flex items-center gap-2 text-xs"><Checkbox checked={form.isExternal} onCheckedChange={(v) => setForm({ ...form, isExternal: !!v })} />External collaborator (vendor, label, agency)</label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!form.name.trim() || !/.+@.+\..+/.test(form.email) || add.isPending} onClick={() => add.mutate({ workspace: ws.slug, name: form.name.trim(), email: form.email.trim(), role: form.role, permission: form.permission, title: form.title || undefined, company: form.company || undefined, isExternal: form.isExternal })}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
