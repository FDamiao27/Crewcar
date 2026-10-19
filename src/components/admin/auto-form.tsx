"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition, type ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";

/** Formulário GET de filtros: aplica automaticamente ao mudar listas e ao submeter a pesquisa. */
export function AutoForm({ action, children, className }: { action: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  const go = () => {
    const form = ref.current;
    if (!form) return;
    const qs = new URLSearchParams();
    for (const [k, v] of new FormData(form).entries()) if (typeof v === "string" && v.trim() !== "") qs.set(k, v.trim());
    start(() => router.replace(qs.size ? `${action}?${qs}` : action, { scroll: false }));
  };

  return (
    <form
      ref={ref}
      action={action}
      method="get"
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      onChange={(e) => {
        if ((e.target as HTMLElement).tagName === "SELECT") go();
      }}
    >
      {children}
      {pending && <Spinner className="size-4 text-metal" />}
    </form>
  );
}
