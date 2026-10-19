import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export function AdminPagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  const cls = "flex h-9 min-w-9 items-center justify-center rounded-sm border border-line px-2 text-sm text-soft hover:border-white/40";
  return (
    <nav aria-label="Paginação" className="mt-6 flex items-center justify-between gap-4 text-sm text-metal">
      <span className="tabular">
        Página {page} de {pages}
      </span>
      <div className="flex gap-1.5">
        {page > 1 ? (
          <Link href={href(page - 1)} className={cls} aria-label="Página anterior">
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <span className={cn(cls, "opacity-30")} aria-hidden="true">
            <ChevronLeft className="size-4" />
          </span>
        )}
        {page < pages ? (
          <Link href={href(page + 1)} className={cls} aria-label="Página seguinte">
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={cn(cls, "opacity-30")} aria-hidden="true">
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}

export function buildHref(base: string, params: Record<string, string | number | undefined>, overrides: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...overrides })) if (v !== undefined && v !== "" && !(k === "pagina" && v === 1)) qs.set(k, String(v));
  return qs.size ? `${base}?${qs}` : base;
}
