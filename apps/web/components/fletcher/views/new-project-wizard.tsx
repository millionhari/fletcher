"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Disc3, Film, ListMusic, Megaphone, Music2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { fmtDate, offsetLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addDaysISO, generateCommsMoments, generateTasks, PROJECT_TYPE_LABELS, timelineTemplateDefSchema, commsTemplateDefSchema, todayISO, snapToWeekday, type ProjectType, type TimelineTemplateDef, type CommsTemplateDef } from "@fletcher/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/fletcher/page-header";
import { RolePill } from "@/components/fletcher/role-pill";

const TYPES: { type: ProjectType; icon: React.ComponentType<{ className?: string }>; blurb: string }[] = [
  { type: "single", icon: Music2, blurb: "One track. Production → distro → pitch → announce → release → reports." },
  { type: "album", icon: Disc3, blurb: "Four-single waterfall, album announce, focus track, deluxe." },
  { type: "ep", icon: ListMusic, blurb: "Two singles and an EP announce, six weeks out." },
  { type: "music_video", icon: Film, blurb: "Treatment, shoot, cuts, review rounds, premiere." },
  { type: "tour", icon: Ticket, blurb: "Announce, staggered presales, Friday on-sale." },
  { type: "campaign", icon: Megaphone, blurb: "Blank canvas with a date. Add tasks by hand." },
];

function defaultDateFor(type: ProjectType): string {
  const today = todayISO();
  if (type === "single") return snapToWeekday(addDaysISO(today, 63), "fri", "forward");
  if (type === "album" || type === "ep") return snapToWeekday(addDaysISO(today, 180), "fri", "forward");
  if (type === "music_video") return snapToWeekday(addDaysISO(today, 42), "fri", "forward");
  if (type === "tour") return snapToWeekday(addDaysISO(today, 21), "mon", "forward");
  return addDaysISO(today, 30);
}

export function NewProjectWizard({ parentProjectId, initialType }: { parentProjectId?: string; initialType?: string }) {
  const ws = useWorkspace();
  const trpc = useTRPC();
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<ProjectType>((TYPES.some((t) => t.type === initialType) ? (initialType as ProjectType) : "single"));
  const [name, setName] = useState("");
  const [anchorDate, setAnchorDate] = useState(defaultDateFor(type));
  const [timelineTemplateId, setTimelineTemplateId] = useState<string | null>(null);
  const [commsTemplateId, setCommsTemplateId] = useState<string | null>(null);
  const [enabledOptions, setEnabledOptions] = useState<string[]>([]);

  const templates = useQuery(trpc.templates.list.queryOptions({ workspace: ws.slug, projectType: type }));
  const timelineTemplates = (templates.data ?? []).filter((t) => t.kind === "timeline");
  const commsTemplates = (templates.data ?? []).filter((t) => t.kind === "comms");
  const chosenTimeline = timelineTemplates.find((t) => t.id === timelineTemplateId) ?? timelineTemplates.find((t) => !t.isSystem && t.isDefault) ?? timelineTemplates.find((t) => t.isSystem) ?? null;
  const chosenComms = commsTemplates.find((t) => t.id === commsTemplateId) ?? commsTemplates.find((t) => !t.isSystem && t.isDefault) ?? commsTemplates.find((t) => t.isSystem) ?? null;

  const timelineDef = useMemo<TimelineTemplateDef | null>(() => {
    if (!chosenTimeline) return null;
    const r = timelineTemplateDefSchema.safeParse(chosenTimeline.definition);
    return r.success ? r.data : null;
  }, [chosenTimeline]);
  const commsDef = useMemo<CommsTemplateDef | null>(() => {
    if (!chosenComms) return null;
    const r = commsTemplateDefSchema.safeParse(chosenComms.definition);
    return r.success ? (r.data as CommsTemplateDef) : null;
  }, [chosenComms]);

  const preview = useMemo(() => (timelineDef ? generateTasks(timelineDef, anchorDate, { enabledOptions }) : []), [timelineDef, anchorDate, enabledOptions]);
  const momentsPreview = useMemo(() => (commsDef ? generateCommsMoments(commsDef, anchorDate) : []), [commsDef, anchorDate]);

  const create = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess: async (project) => {
        await qc.invalidateQueries();
        toast.success(`${project.name} created`, { description: `${preview.length} tasks and ${momentsPreview.length} rollout moments generated.` });
        router.push(`/w/${ws.slug}/projects/${project.id}/timeline`);
        router.refresh();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const pickType = (t: ProjectType) => {
    setType(t);
    setAnchorDate(defaultDateFor(t));
    setTimelineTemplateId(null);
    setCommsTemplateId(null);
    setEnabledOptions([]);
  };

  const canContinue = step === 0 || (step === 1 && name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(anchorDate));
  const phases = timelineDef?.phases ?? [];

  return (
    <div className="fade-in-up mx-auto max-w-4xl">
      <PageHeader eyebrow={parentProjectId ? "Child project" : "New project"} title={step === 0 ? "What are you planning?" : step === 1 ? "Name it and pick the date" : "Review the generated plan"} description={step === 0 ? "Pick a type. Each one ships with an industry-standard timeline and comms plan you can customize." : step === 1 ? "Everything is scheduled backward from this date. You can move it later and the plan re-flows." : "These tasks and rollout moments will be created. Edit any of them after."} />

      <div className="mb-6 flex items-center gap-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
        {["Type", "Details", "Review"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cn("flex size-5 items-center justify-center rounded-full border text-[10px]", i < step ? "border-success bg-success text-white" : i === step ? "border-foreground text-foreground" : "border-border")}>{i < step ? <Check className="size-3" /> : i + 1}</span>
            <span className={i === step ? "text-foreground" : ""}>{s}</span>
            {i < 2 && <span className="mx-1 h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TYPES.map((t) => (
            <button key={t.type} onClick={() => pickType(t.type)} className={cn("surface group flex flex-col items-start gap-3 p-4 text-left transition-all hover:shadow-float", type === t.type && "ring-2 ring-brand")}>
              <span className={cn("flex size-9 items-center justify-center rounded-lg bg-muted text-foreground transition-colors", type === t.type && "bg-brand-soft text-brand")}><t.icon className="size-4" /></span>
              <span>
                <span className="block text-sm font-semibold">{PROJECT_TYPE_LABELS[t.type]}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{t.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          <div className="surface space-y-5 p-5">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Project name</Label>
              <Input id="name" autoFocus placeholder={type === "single" ? "Song title" : type === "album" ? "Album title" : "Name"} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="date">{timelineDef?.anchorLabel ?? "Date"}</Label>
              <Input id="date" type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} className="w-56 tabular" />
              <p className="text-2xs text-muted-foreground">{type === "single" || type === "album" || type === "ep" ? "Releases land on Fridays (global release day)." : type === "tour" ? "Announces usually go out on a Monday; on-sale lands the Friday after." : ""}</p>
            </div>
            {timelineDef?.options && timelineDef.options.length > 0 && (
              <div className="grid gap-2">
                <Label>Options</Label>
                {timelineDef.options.map((o) => (
                  <label key={o.key} className="flex items-start gap-2.5 rounded-lg border border-border p-3">
                    <Checkbox checked={enabledOptions.includes(o.key)} onCheckedChange={(v) => setEnabledOptions((prev) => (v ? [...prev, o.key] : prev.filter((k) => k !== o.key)))} />
                    <span>
                      <span className="block text-sm font-medium">{o.label}</span>
                      {o.description && <span className="block text-xs text-muted-foreground">{o.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <TemplatePicker label="Timeline template" items={timelineTemplates} value={chosenTimeline?.id ?? null} onChange={setTimelineTemplateId} />
            <TemplatePicker label="Comms template" items={commsTemplates} value={chosenComms?.id ?? null} onChange={setCommsTemplateId} allowNone />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-xs font-semibold">{name}</span>
              <span className="tabular text-xs text-muted-foreground">{preview.length} tasks · {timelineDef?.anchorLabel} {fmtDate(anchorDate, "weekday")}</span>
            </div>
            <div className="scrollbar-thin max-h-[520px] overflow-y-auto">
              {phases.map((ph) => {
                const rows = preview.filter((t) => t.phase === ph.key);
                if (!rows.length) return null;
                return (
                  <div key={ph.key}>
                    <div className="sticky top-0 bg-muted/80 px-4 py-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">{ph.title}</div>
                    {rows.map((t) => (
                      <div key={t.key} className="flex items-center gap-3 border-b border-border px-4 py-1.5 last:border-0">
                        <span className="tabular w-14 shrink-0 font-mono text-2xs text-muted-foreground">{offsetLabel(t.dueDate, anchorDate)}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px]">{t.title}</span>
                        <RolePill role={t.roleKey} />
                        <span className="tabular w-16 shrink-0 text-right text-xs text-muted-foreground">{fmtDate(t.dueDate)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="surface self-start overflow-hidden">
            <div className="border-b border-border px-4 py-2.5 text-xs font-semibold">Rollout moments</div>
            {momentsPreview.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">No comms template for this type.</p>
            ) : (
              momentsPreview.map((m) => (
                <div key={m.key} className="flex items-center gap-3 border-b border-border px-4 py-1.5 last:border-0">
                  <span className="tabular w-12 shrink-0 text-xs text-muted-foreground">{fmtDate(m.scheduledDate)}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{m.title}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => (step === 0 ? router.back() : setStep(step - 1))}><ArrowLeft />{step === 0 ? "Cancel" : "Back"}</Button>
        {step < 2 ? (
          <Button size="sm" disabled={!canContinue} onClick={() => setStep(step + 1)}>Continue<ArrowRight /></Button>
        ) : (
          <Button size="sm" disabled={create.isPending} onClick={() => create.mutate({ workspace: ws.slug, type, name: name.trim(), anchorDate, timelineTemplateId: chosenTimeline?.id ?? null, commsTemplateId: chosenComms?.id ?? null, enabledOptions, parentProjectId: parentProjectId ?? null })}>
            {create.isPending ? "Creating…" : `Create ${PROJECT_TYPE_LABELS[type].toLowerCase()}`}
          </Button>
        )}
      </div>
    </div>
  );
}

function TemplatePicker({ label, items, value, onChange, allowNone }: { label: string; items: { id: string; name: string; description: string | null; isSystem: boolean; isDefault: boolean }[]; value: string | null; onChange: (id: string | null) => void; allowNone?: boolean }) {
  return (
    <div className="surface p-3">
      <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="space-y-1">
        {items.map((t) => (
          <button key={t.id} onClick={() => onChange(t.id)} className={cn("flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted", value === t.id && "bg-muted")}>
            <span className={cn("mt-1 size-3 shrink-0 rounded-full border", value === t.id ? "border-brand bg-brand" : "border-border")} />
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium">{t.name} {t.isSystem ? <span className="text-muted-foreground">· system</span> : <span className="text-brand">· custom</span>}</span>
              {t.description && <span className="line-clamp-2 block text-2xs text-muted-foreground">{t.description}</span>}
            </span>
          </button>
        ))}
        {items.length === 0 && <p className="px-2 text-xs text-muted-foreground">{allowNone ? "No template for this type." : "No template."}</p>}
      </div>
    </div>
  );
}
