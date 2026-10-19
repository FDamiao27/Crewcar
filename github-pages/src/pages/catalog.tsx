import { CarFront, ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { CatalogFilters, SortSelect } from "@/components/site/catalog-filters";
import { Container, PageHero } from "@/components/site/section";
import { VehicleGrid } from "@/components/site/vehicle-card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { activeFilterCount, catalogHref, parseCatalogParams, type CatalogParams } from "@/lib/catalog-params";
import { cn } from "@/lib/cn";
import { CATEGORIES, FUELS, TRANSMISSIONS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { searchCatalog } from "../catalog";
import { useMeta, useShowroom } from "../showroom";

const SORTS = {
  recentes: "Mais recentes",
  preco_asc: "Preço: mais baixo",
  preco_desc: "Preço: mais alto",
  ano_desc: "Ano: mais recente",
  ano_asc: "Ano: mais antigo",
  km_asc: "Quilómetros: menos",
  km_desc: "Quilómetros: mais",
};

function chips(p: CatalogParams): { label: string; remove: Partial<CatalogParams> }[] {
  const out: { label: string; remove: Partial<CatalogParams> }[] = [];
  if (p.q) out.push({ label: `“${p.q}”`, remove: { q: undefined } });
  if (p.marca) out.push({ label: p.marca, remove: { marca: undefined, modelo: undefined } });
  if (p.modelo) out.push({ label: p.modelo, remove: { modelo: undefined } });
  if (p.precoMin) out.push({ label: `Desde ${formatNumber(p.precoMin)} €`, remove: { precoMin: undefined } });
  if (p.precoMax) out.push({ label: `Até ${formatNumber(p.precoMax)} €`, remove: { precoMax: undefined } });
  if (p.anoMin) out.push({ label: `Desde ${p.anoMin}`, remove: { anoMin: undefined } });
  if (p.anoMax) out.push({ label: `Até ${p.anoMax}`, remove: { anoMax: undefined } });
  if (p.kmMax) out.push({ label: `Até ${formatNumber(p.kmMax)} km`, remove: { kmMax: undefined } });
  if (p.combustivel) out.push({ label: FUELS[p.combustivel as keyof typeof FUELS], remove: { combustivel: undefined } });
  if (p.caixa) out.push({ label: TRANSMISSIONS[p.caixa as keyof typeof TRANSMISSIONS], remove: { caixa: undefined } });
  if (p.categoria) out.push({ label: CATEGORIES[p.categoria as keyof typeof CATEGORIES], remove: { categoria: undefined } });
  return out;
}

function pageList(current: number, total: number): (number | "…")[] {
  const pages = [...new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total))].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

export function CatalogPage() {
  const { settings, vehicles } = useShowroom();
  const [sp] = useSearchParams();
  const params = parseCatalogParams(Object.fromEntries(sp.entries()));
  const perPage = settings.publishing.perPage;
  const result = searchCatalog(vehicles, params, perPage, settings.publishing.showReserved);
  const active = activeFilterCount(params);
  const activeChips = chips(params);
  const from = result.total ? (result.page - 1) * perPage + 1 : 0;
  const to = Math.min(result.total, result.page * perPage);
  useMeta(
    params.marca ? `${params.marca}${params.modelo ? ` ${params.modelo}` : ""} — viaturas` : "Viaturas",
    "Consulte todas as viaturas disponíveis na Crew Car: pesquise por marca, modelo, preço, ano e quilometragem.",
  );

  return (
    <>
      <PageHero eyebrow="Catálogo" title="Viaturas" subtitle="Pesquise, compare e encontre a viatura certa para si." />
      <Container className="py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-[17rem_1fr]">
          <aside aria-label="Filtros" className="lg:sticky lg:top-[calc(var(--header-offset)+1.5rem)] lg:self-start">
            <CatalogFilters params={params} facets={result.facets} activeCount={active} />
          </aside>

          <section aria-labelledby="resultados" aria-live="polite">
            <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="resultados" className="text-sm text-metal">
                <span className="font-semibold text-white tabular">{formatNumber(result.total)}</span>{" "}
                {result.total === 1 ? "viatura encontrada" : "viaturas encontradas"}
                {result.total > perPage && (
                  <span className="tabular">
                    {" "}
                    · a mostrar {from}–{to}
                  </span>
                )}
              </h2>
              <SortSelect params={params} sorts={SORTS} />
            </div>

            {activeChips.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Filtros ativos">
                {activeChips.map((c) => (
                  <li key={c.label}>
                    <Link
                      href={catalogHref(params, { ...c.remove, pagina: undefined })}
                      scroll={false}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.03] py-1 pr-2.5 pl-3 text-xs text-soft hover:border-white/40"
                      aria-label={`Remover filtro ${c.label}`}
                    >
                      {c.label} <X className="size-3 text-metal" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-8">
              {result.items.length > 0 ? (
                <VehicleGrid vehicles={result.items} priorityCount={3} />
              ) : (
                <EmptyState
                  icon={<CarFront />}
                  title={active ? "Nenhuma viatura corresponde à pesquisa" : "Ainda não existem viaturas publicadas"}
                  description={
                    active ? "Experimente alargar os critérios ou limpar os filtros." : "O stock está a ser atualizado. Fale connosco para saber que viaturas estão a chegar."
                  }
                  action={
                    active ? (
                      <LinkButton href="/viaturas" variant="secondary">
                        Limpar filtros
                      </LinkButton>
                    ) : (
                      <LinkButton href="/contactos">Contactar</LinkButton>
                    )
                  }
                />
              )}
            </div>

            {result.pages > 1 && (
              <nav aria-label="Paginação" className="mt-12 flex items-center justify-center gap-1">
                <PageLink href={catalogHref(params, { pagina: result.page - 1 })} disabled={result.page <= 1} label="Página anterior">
                  <ChevronLeft className="size-4" />
                </PageLink>
                {pageList(result.page, result.pages).map((n, i) =>
                  n === "…" ? (
                    <span key={`e${i}`} className="px-2 text-metal">
                      …
                    </span>
                  ) : (
                    <PageLink key={n} href={catalogHref(params, { pagina: n })} current={n === result.page} label={`Página ${n}`}>
                      {n}
                    </PageLink>
                  ),
                )}
                <PageLink href={catalogHref(params, { pagina: result.page + 1 })} disabled={result.page >= result.pages} label="Página seguinte">
                  <ChevronRight className="size-4" />
                </PageLink>
              </nav>
            )}
          </section>
        </div>
      </Container>
    </>
  );
}

function PageLink({ href, children, current, disabled, label }: { href: string; children: ReactNode; current?: boolean; disabled?: boolean; label: string }) {
  const cls = cn(
    "flex size-10 items-center justify-center rounded-sm border text-sm tabular transition-colors",
    current ? "border-white bg-white text-ink" : "border-line text-soft hover:border-white/50",
    disabled && "pointer-events-none opacity-30",
  );
  if (disabled)
    return (
      <span className={cls} aria-hidden="true">
        {children}
      </span>
    );
  return (
    <Link href={href} className={cls} aria-label={label} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}
