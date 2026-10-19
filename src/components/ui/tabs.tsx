"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Separadores acessíveis (setas esquerda/direita para navegar). */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: ReactNode; error?: boolean; disabled?: boolean }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  const enabled = tabs.filter((t) => !t.disabled);
  return (
    <div
      role="tablist"
      aria-label={label}
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0"
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const i = enabled.findIndex((t) => t.id === value);
        const next = enabled[(i + (e.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length];
        onChange(next.id);
        document.getElementById(`tab-${next.id}`)?.focus();
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          id={`tab-${t.id}`}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          aria-controls={`painel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          disabled={t.disabled}
          onClick={() => onChange(t.id)}
          className={cn(
            "relative -mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-3 text-sm whitespace-nowrap transition-colors disabled:opacity-40",
            value === t.id ? "border-white text-white" : "border-transparent text-metal hover:text-soft",
          )}
        >
          {t.label}
          {t.error && <span className="size-1.5 rounded-full bg-danger" aria-label="(contém erros)" />}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, active, children }: { id: string; active: boolean; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`painel-${id}`} aria-labelledby={`tab-${id}`} hidden={!active} className="pt-6">
      {children}
    </div>
  );
}
