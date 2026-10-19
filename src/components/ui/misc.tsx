import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "light" | "ok" | "warn" | "danger" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-white/[0.07] text-soft border-line",
  light: "bg-white text-ink border-white",
  ok: "bg-ok/10 text-ok border-ok/30",
  warn: "bg-warn/10 text-warn border-warn/30",
  danger: "bg-danger/10 text-danger border-danger/30",
  outline: "bg-ink/70 text-white border-line-strong backdrop-blur",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-sm border border-dashed border-line px-6 py-16 text-center", className)}>
      {icon && <div className="mb-4 text-metal/70 [&_svg]:size-8 [&_svg]:stroke-[1.25]">{icon}</div>}
      <p className="text-base font-semibold text-white">{title}</p>
      {description && <div className="mt-2 max-w-md text-sm text-metal">{description}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-white/[0.05]", className)} aria-hidden="true" />;
}

export function Notice({ tone = "neutral", title, children, className }: { tone?: "neutral" | "warn" | "danger" | "ok"; title?: string; children: ReactNode; className?: string }) {
  const toneClass = {
    neutral: "border-line bg-white/[0.03] text-soft",
    warn: "border-warn/30 bg-warn/[0.06] text-soft",
    danger: "border-danger/30 bg-danger/[0.06] text-soft",
    ok: "border-ok/30 bg-ok/[0.06] text-soft",
  }[tone];
  return (
    <div className={cn("rounded-sm border px-4 py-3 text-sm", toneClass, className)} role={tone === "danger" ? "alert" : undefined}>
      {title && <p className="mb-1 font-semibold text-white">{title}</p>}
      <div className="text-soft/85">{children}</div>
    </div>
  );
}
