import { cn } from "@/lib/utils";

export function PageHeader({ title, description, eyebrow, actions, className, children }: { title: React.ReactNode; description?: React.ReactNode; eyebrow?: React.ReactNode; actions?: React.ReactNode; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4", className)}>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-xs font-medium text-muted-foreground">{eyebrow}</div>}
          <h1 className="truncate text-xl font-semibold leading-7">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function SectionHeader({ title, count, actions, className }: { title: React.ReactNode; count?: number; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2", className)}>
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
        {count !== undefined && <span className="tabular rounded-md bg-muted px-1.5 py-px text-2xs font-medium">{count}</span>}
      </h2>
      {actions}
    </div>
  );
}
