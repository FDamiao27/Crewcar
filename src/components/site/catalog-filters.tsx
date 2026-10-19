"use client";

import { SlidersHorizontal, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { fieldBase, inputClass } from "@/components/ui/styles";
import { Spinner } from "@/components/ui/spinner";
import { catalogHref, type CatalogParams } from "@/lib/catalog-params";
import { cn } from "@/lib/cn";
import { CATEGORIES, FUELS, TRANSMISSIONS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";

type Facets = {
  brands: { value: string; count: number }[];
  models: { value: string; count: number }[];
  fuels: string[];
  transmissions: string[];
  categories: string[];
  years: { min: number | null; max: number | null };
};

const PRICE_STEPS = [5000, 7500, 10000, 12500, 15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000, 150000];
const KM_STEPS = [10000, 25000, 50000, 75000, 100000, 150000, 200000];

const selectCls = cn(
  inputClass,
    "cc-select",
);

function Labelled({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="eyebrow !text-[0.6rem]">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Filtros do catálogo. Cada alteração atualiza o URL (partilhável) e o servidor devolve
 * os resultados filtrados a partir da base de dados. Sem JavaScript, funciona como formulário GET.
 */
export function CatalogFilters({ params, facets, activeCount }: { params: CatalogParams; facets: Facets; activeCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(params.q ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQ(params.q ?? ""), [params.q]);

  const apply = (overrides: Partial<CatalogParams>) => {
    startTransition(() => router.replace(catalogHref(params, { ...overrides, pagina: undefined }), { scroll: false }));
  };

  const onSelect = (key: keyof CatalogParams, numeric = false) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    const value = v === "" ? undefined : numeric ? Number(v) : v;
    apply(key === "marca" ? { marca: value as string | undefined, modelo: undefined } : { [key]: value });
  };

  const currentYear = new Date().getFullYear();
  const minYear = facets.years.min ?? currentYear - 20;
  const years: number[] = [];
  for (let y = Math.max(facets.years.max ?? currentYear, currentYear); y >= Math.min(minYear, currentYear); y--) years.push(y);

  const fuelOptions = Object.entries(FUELS).filter(([k]) => facets.fuels.includes(k) || params.combustivel === k);
  const transOptions = Object.entries(TRANSMISSIONS).filter(([k]) => facets.transmissions.includes(k) || params.caixa === k);
  const catOptions = Object.entries(CATEGORIES).filter(([k]) => facets.categories.includes(k) || params.categoria === k);

  return (
    <div>
      <div className="flex items-center gap-3 lg:hidden">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="painel-filtros"
          icon={<SlidersHorizontal className="size-4" />}
          className="w-full"
        >
          Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </div>

      <form
        id="painel-filtros"
        action="/viaturas"
        method="get"
        role="search"
        aria-label="Filtrar viaturas"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: q.trim() || undefined });
        }}
        className={cn("mt-4 space-y-5 lg:mt-0 lg:block", open ? "block" : "hidden")}
        aria-busy={pending}
      >
        <div className="relative">
          <label htmlFor="f-q" className="sr-only">
            Pesquisar
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-metal" aria-hidden="true" />
          <input
            id="f-q"
            name="q"
            type="search"
            value={q}
            placeholder="Pesquisar viaturas…"
            className={cn(inputClass, "pl-9")}
            onChange={(e) => {
              const value = e.target.value;
              setQ(value);
              if (debounce.current) clearTimeout(debounce.current);
              debounce.current = setTimeout(() => apply({ q: value.trim() || undefined }), 450);
            }}
          />
        </div>

        <Labelled label="Marca" htmlFor="f-marca">
          <select id="f-marca" name="marca" className={selectCls} value={params.marca ?? ""} onChange={onSelect("marca")}>
            <option value="">Todas</option>
            {facets.brands.map((b) => (
              <option key={b.value} value={b.value}>
                {b.value} ({b.count})
              </option>
            ))}
          </select>
        </Labelled>

        <Labelled label="Modelo" htmlFor="f-modelo">
          <select
            id="f-modelo"
            name="modelo"
            className={selectCls}
            value={params.modelo ?? ""}
            onChange={onSelect("modelo")}
            disabled={!params.marca}
          >
            <option value="">{params.marca ? "Todos" : "Escolha primeiro a marca"}</option>
            {facets.models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.value} ({m.count})
              </option>
            ))}
          </select>
        </Labelled>

        <div className="grid grid-cols-2 gap-3">
          <Labelled label="Preço mín." htmlFor="f-pmin">
            <select id="f-pmin" name="precoMin" className={selectCls} value={params.precoMin ?? ""} onChange={onSelect("precoMin", true)}>
              <option value="">Mín.</option>
              {PRICE_STEPS.map((p) => (
                <option key={p} value={p}>
                  {formatNumber(p)} €
                </option>
              ))}
            </select>
          </Labelled>
          <Labelled label="Preço máx." htmlFor="f-pmax">
            <select id="f-pmax" name="precoMax" className={selectCls} value={params.precoMax ?? ""} onChange={onSelect("precoMax", true)}>
              <option value="">Máx.</option>
              {PRICE_STEPS.map((p) => (
                <option key={p} value={p}>
                  {formatNumber(p)} €
                </option>
              ))}
            </select>
          </Labelled>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Labelled label="Ano desde" htmlFor="f-amin">
            <select id="f-amin" name="anoMin" className={selectCls} value={params.anoMin ?? ""} onChange={onSelect("anoMin", true)}>
              <option value="">Qualquer</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Labelled>
          <Labelled label="Ano até" htmlFor="f-amax">
            <select id="f-amax" name="anoMax" className={selectCls} value={params.anoMax ?? ""} onChange={onSelect("anoMax", true)}>
              <option value="">Qualquer</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Labelled>
        </div>

        <Labelled label="Quilómetros até" htmlFor="f-km">
          <select id="f-km" name="kmMax" className={selectCls} value={params.kmMax ?? ""} onChange={onSelect("kmMax", true)}>
            <option value="">Qualquer</option>
            {KM_STEPS.map((k) => (
              <option key={k} value={k}>
                {formatNumber(k)} km
              </option>
            ))}
          </select>
        </Labelled>

        <Labelled label="Combustível" htmlFor="f-fuel">
          <select id="f-fuel" name="combustivel" className={selectCls} value={params.combustivel ?? ""} onChange={onSelect("combustivel")}>
            <option value="">Todos</option>
            {fuelOptions.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Labelled>

        <Labelled label="Caixa de velocidades" htmlFor="f-caixa">
          <select id="f-caixa" name="caixa" className={selectCls} value={params.caixa ?? ""} onChange={onSelect("caixa")}>
            <option value="">Todas</option>
            {transOptions.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Labelled>

        <Labelled label="Categoria" htmlFor="f-cat">
          <select id="f-cat" name="categoria" className={selectCls} value={params.categoria ?? ""} onChange={onSelect("categoria")}>
            <option value="">Todas</option>
            {catOptions.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Labelled>

        <noscript>
          <Button type="submit" className="w-full">
            Aplicar filtros
          </Button>
        </noscript>

        <div className="flex min-h-9 items-center justify-between gap-3 border-t border-line pt-4">
          {pending ? <Spinner label="A atualizar…" /> : <span />}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                startTransition(() => router.replace(catalogHref({ ordem: params.ordem }), { scroll: false }));
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-metal hover:text-white"
            >
              <X className="size-3.5" /> Limpar filtros
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export function SortSelect({ params, sorts }: { params: CatalogParams; sorts: Record<string, string> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-3">
      {pending && <Spinner className="size-3.5" />}
      <label htmlFor="ordem" className="eyebrow !text-[0.6rem] whitespace-nowrap">
        Ordenar
      </label>
      <select
        id="ordem"
        className={cn(fieldBase, "cc-select h-9 py-1.5 text-sm")}
        value={params.ordem ?? "recentes"}
        onChange={(e) =>
          startTransition(() => router.replace(catalogHref(params, { ordem: e.target.value, pagina: undefined }), { scroll: false }))
        }
      >
        {Object.entries(sorts).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
