"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";
import { cn } from "@/lib/cn";

/** Editor de listas simples (equipamento, extras). Aceita colar várias linhas de uma vez. */
export function ListEditor({
  label,
  items,
  onChange,
  placeholder,
  max = 300,
  id,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  max?: number;
  id: string;
}) {
  const [draft, setDraft] = useState("");

  const add = (text: string) => {
    const lines = text
      .split(/\r?\n|;/)
      .map((l) => l.replace(/^[-•*]\s*/, "").trim().slice(0, 150))
      .filter(Boolean);
    if (!lines.length) return;
    const existing = new Set(items.map((i) => i.toLowerCase()));
    const next = [...items, ...lines.filter((l) => !existing.has(l.toLowerCase()))].slice(0, max);
    onChange(next);
    setDraft("");
  };

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <label htmlFor={id} className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-metal">
        {label} <span className="font-normal normal-case tracking-normal text-metal/70">({items.length})</span>
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={id}
          value={draft}
          placeholder={placeholder}
          className={inputClass}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/\n/.test(text)) {
              e.preventDefault();
              add(text);
            }
          }}
        />
        <Button type="button" variant="subtle" onClick={() => add(draft)} aria-label={`Adicionar a ${label}`} icon={<Plus className="size-4" />}>
          Adicionar
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-metal/80">Prima Enter para adicionar. Pode colar uma lista com um item por linha.</p>
      {items.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="group flex items-center gap-2 px-3 py-1.5 text-sm">
              <span className="flex-1 text-soft">{item}</span>
              <div className={cn("flex items-center gap-0.5 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100")}>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-sm p-1 text-metal hover:text-white disabled:opacity-30" aria-label={`Mover "${item}" para cima`}>
                  <ArrowUp className="size-3.5" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded-sm p-1 text-metal hover:text-white disabled:opacity-30" aria-label={`Mover "${item}" para baixo`}>
                  <ArrowDown className="size-3.5" />
                </button>
                <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded-sm p-1 text-metal hover:text-danger" aria-label={`Remover "${item}"`}>
                  <X className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
