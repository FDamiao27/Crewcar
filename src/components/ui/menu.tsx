"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type MenuItem =
  | { type?: "item"; label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean }
  | { type: "link"; label: string; icon?: ReactNode; href: string; external?: boolean }
  | { type: "separator" };

/** Menu de ações acessível (teclado: setas, Enter, Esc). */
export function ActionMenu({ items, label = "Ações", trigger }: { items: MenuItem[]; label?: string; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const els = Array.from(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])") ?? []);
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    }
  };

  const itemCls = "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors focus:bg-white/[0.07] focus:outline-none hover:bg-white/[0.05] [&_svg]:size-4 [&_svg]:shrink-0";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="flex size-8 items-center justify-center rounded-sm text-metal hover:bg-white/[0.06] hover:text-white"
      >
        {trigger ?? <MoreHorizontal className="size-4" />}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="absolute right-0 z-50 mt-1 min-w-52 animate-fade-in overflow-hidden rounded-sm border border-line-strong bg-ink-2 py-1 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)]"
        >
          {items.map((item, i) => {
            if (item.type === "separator") return <div key={i} className="my-1 h-px bg-line" role="separator" />;
            if (item.type === "link")
              return (
                <a
                  key={i}
                  role="menuitem"
                  href={item.href}
                  tabIndex={-1}
                  className={cn(itemCls, "text-soft")}
                  {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  onClick={() => setOpen(false)}
                >
                  {item.icon}
                  {item.label}
                </a>
              );
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={item.disabled || undefined}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(itemCls, item.danger ? "text-danger" : "text-soft", item.disabled && "opacity-40")}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
