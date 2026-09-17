import { cn } from "@/lib/utils";

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">{icon}</div>}
      <div className="text-sm font-medium">{title}</div>
      {description && <p className="mt-1 max-w-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
