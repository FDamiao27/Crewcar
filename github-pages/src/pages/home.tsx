import { ArrowRight, CarFront, ChevronDown, Search } from "lucide-react";
import Link from "next/link";
import { useNavigate } from "react-router";
import { AdvantageIcon } from "@/components/site/advantage-icon";
import { ContactDetails } from "@/components/site/contact-details";
import { Container, SectionHeading } from "@/components/site/section";
import { SocialLinks } from "@/components/site/social-icons";
import { VehicleGrid } from "@/components/site/vehicle-card";
import { buttonClass, LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { catalogHref } from "@/lib/catalog-params";
import { formatNumber } from "@/lib/format";
import { Markdown } from "@/lib/markdown";
import { mediaUrl } from "@/lib/media-base";
import { assetUrl } from "@/lib/site-schema";
import { featuredVehicles, latestVehicles, searchCatalog } from "../catalog";
import { useMeta, useShowroom } from "../showroom";

export function HomePage() {
  const { settings, content, vehicles } = useShowroom();
  const navigate = useNavigate();
  useMeta(null, content.seo.description);
  const featured = featuredVehicles(vehicles, 6);
  const latest = content.home.showLatest ? latestVehicles(vehicles, 6) : [];
  const available = vehicles.filter((v) => v.status !== "vendido").length;
  const brands = searchCatalog(vehicles, {}, 1, settings.publishing.showReserved).facets.brands;
  const { hero, home } = content;
  const heroImage = hero.image;
  const hasVehicles = available > 0;

  return (
    <>
      <section className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden bg-ink">
        {heroImage ? (
          <>
            <img
              src={assetUrl(heroImage, 1920)}
              srcSet={heroImage.variants.map((w) => `${mediaUrl(`${heroImage.key}-${w}.webp`)} ${w}w`).join(", ")}
              sizes="100vw"
              alt=""
              fetchPriority="high"
              className="absolute inset-0 -z-20 size-full object-cover"
            />
            <div
              className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/60 to-ink/30"
              style={{ opacity: Math.max(0.35, hero.overlay / 100 + 0.25) }}
              aria-hidden="true"
            />
            <div className="absolute inset-0 -z-10 bg-ink" style={{ opacity: hero.overlay / 200 }} aria-hidden="true" />
          </>
        ) : (
          <div className="hero-backdrop absolute inset-0 -z-10" aria-hidden="true">
            <div className="absolute inset-x-0 top-[38%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="absolute inset-y-0 left-[62%] hidden w-px bg-gradient-to-b from-transparent via-white/[0.07] to-transparent md:block" />
            <div className="absolute right-[-8%] bottom-[-30%] size-[70vmin] rounded-full border border-white/[0.05]" />
            <div className="absolute right-[2%] bottom-[-18%] size-[48vmin] rounded-full border border-white/[0.04]" />
          </div>
        )}

        <Container className="pt-[calc(var(--header-offset)+4rem)] pb-14 md:pb-20">
          <div className="max-w-4xl animate-fade-up">
            {hero.eyebrow && <p className="eyebrow mb-6">{hero.eyebrow}</p>}
            <h1 className="display-title text-[2.6rem] text-white sm:text-6xl lg:text-[5.4rem]">{hero.title}</h1>
            {hero.subtitle && <p className="mt-6 max-w-xl text-base leading-relaxed text-soft/80 md:text-lg">{hero.subtitle}</p>}
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/viaturas" size="lg" icon={<ArrowRight className="size-4" />} className="flex-row-reverse">
                {hero.primaryCta}
              </LinkButton>
              <LinkButton href="/contactos" size="lg" variant="secondary">
                {hero.secondaryCta}
              </LinkButton>
            </div>
          </div>

          {hasVehicles && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const marca = String(fd.get("marca") ?? "") || undefined;
                const precoMax = Number(fd.get("precoMax")) || undefined;
                navigate(catalogHref({ marca, precoMax }));
              }}
              className="mt-14 grid animate-fade-up gap-px overflow-hidden rounded-sm border border-line bg-line [animation-delay:150ms] sm:grid-cols-[1fr_1fr_auto] md:mt-20 md:max-w-3xl"
              role="search"
              aria-label="Pesquisa rápida de viaturas"
            >
              <label className="flex flex-col gap-1 bg-ink/85 px-5 py-3.5 backdrop-blur">
                <span className="eyebrow !text-[0.58rem]">Marca</span>
                <select name="marca" className="bg-transparent text-sm text-white focus:outline-none" defaultValue="">
                  <option value="" className="bg-ink-2">
                    Todas as marcas
                  </option>
                  {brands.map((b) => (
                    <option key={b.value} value={b.value} className="bg-ink-2">
                      {b.value} ({b.count})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 bg-ink/85 px-5 py-3.5 backdrop-blur">
                <span className="eyebrow !text-[0.58rem]">Preço máximo</span>
                <select name="precoMax" className="bg-transparent text-sm text-white focus:outline-none" defaultValue="">
                  <option value="" className="bg-ink-2">
                    Sem limite
                  </option>
                  {[10000, 15000, 20000, 30000, 40000, 50000, 75000, 100000].map((p) => (
                    <option key={p} value={p} className="bg-ink-2">
                      Até {formatNumber(p)} €
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={buttonClass("primary", "lg", "h-full rounded-none px-8")}>
                <Search className="size-4" /> Pesquisar
              </button>
            </form>
          )}

          <div className="mt-10 flex items-center justify-between text-xs text-metal">
            <p className="tabular">{hasVehicles ? `${formatNumber(available)} ${available === 1 ? "viatura disponível" : "viaturas disponíveis"}` : ""}</p>
            <a href="#destaques" className="hidden items-center gap-2 uppercase tracking-[0.18em] hover:text-white md:flex">
              Descobrir <ChevronDown className="size-3.5 motion-safe:animate-bounce" />
            </a>
          </div>
        </Container>
      </section>

      <div id="destaques" className="scroll-mt-20">
        {featured.length > 0 && (
          <section className="py-20 md:py-28">
            <Container>
              <SectionHeading
                eyebrow="Seleção"
                title={home.featuredTitle || "Em destaque"}
                subtitle={home.featuredSubtitle}
                action={
                  <LinkButton href="/viaturas" variant="secondary" icon={<ArrowRight className="size-4" />} className="flex-row-reverse">
                    Ver todas
                  </LinkButton>
                }
              />
              <div className="mt-12">
                <VehicleGrid vehicles={featured} />
              </div>
            </Container>
          </section>
        )}

        {latest.length > 0 && (
          <section className={featured.length ? "border-t border-line py-20 md:py-28" : "py-20 md:py-28"}>
            <Container>
              <SectionHeading
                eyebrow="Catálogo"
                title={home.latestTitle || "Chegadas recentes"}
                subtitle={home.latestSubtitle}
                action={
                  <LinkButton href="/viaturas" variant="secondary" icon={<ArrowRight className="size-4" />} className="flex-row-reverse">
                    Catálogo completo
                  </LinkButton>
                }
              />
              <div className="mt-12">
                <VehicleGrid vehicles={latest} />
              </div>
            </Container>
          </section>
        )}

        {!hasVehicles && (
          <section className="py-20 md:py-28">
            <Container>
              <EmptyState
                icon={<CarFront />}
                title="O nosso stock está a ser atualizado"
                description="Em breve poderá consultar aqui as viaturas disponíveis. Entretanto, fale connosco — teremos todo o gosto em ajudar."
                action={<LinkButton href="/contactos">Falar com a Crew Car</LinkButton>}
              />
            </Container>
          </section>
        )}
      </div>

      {home.showAbout && (content.about.lead || content.about.body) && (
        <section className="border-t border-line bg-ink-2 py-20 md:py-28">
          <Container className="grid gap-12 md:grid-cols-12">
            <div className="md:col-span-5">
              <p className="eyebrow mb-3">{settings.brandName}</p>
              <h2 className="display-title text-3xl text-white md:text-[2.6rem]">{content.about.title}</h2>
            </div>
            <div className="md:col-span-7">
              {content.about.lead && <p className="text-xl leading-relaxed text-soft md:text-2xl">{content.about.lead}</p>}
              {content.about.body && (
                <div className="mt-6 line-clamp-6">
                  <Markdown source={content.about.body} />
                </div>
              )}
              <Link
                href="/o-stand"
                className="mt-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-[gap] hover:gap-3"
              >
                Conhecer o stand <ArrowRight className="size-4" />
              </Link>
            </div>
          </Container>
        </section>
      )}

      {home.showAdvantages && content.advantages.items.length > 0 && (
        <section className="border-t border-line py-20 md:py-28">
          <Container>
            <SectionHeading eyebrow="Vantagens" title={content.advantages.title || "Porquê a Crew Car"} />
            <ul className="mt-12 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {content.advantages.items.map((a, i) => (
                <li key={i} className="bg-ink p-8">
                  <AdvantageIcon name={a.icon} className="size-6 text-white" />
                  <h3 className="mt-6 text-base font-semibold text-white">{a.title}</h3>
                  {a.text && <p className="mt-2 text-sm leading-relaxed text-metal">{a.text}</p>}
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {home.showFaq && content.faq.items.length > 0 && (
        <section className="border-t border-line py-20 md:py-28">
          <Container className="grid gap-12 md:grid-cols-12">
            <div className="md:col-span-4">
              <SectionHeading eyebrow="Ajuda" title={content.faq.title || "Perguntas frequentes"} />
            </div>
            <div className="md:col-span-8">
              {content.faq.items.map((f, i) => (
                <details key={i} className="group border-b border-line py-5 first:border-t">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-base font-medium text-white [&::-webkit-details-marker]:hidden">
                    {f.question}
                    <ChevronDown className="size-4 shrink-0 text-metal transition-transform duration-300 group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 pr-10 text-sm leading-relaxed whitespace-pre-line text-metal">{f.answer}</p>
                </details>
              ))}
            </div>
          </Container>
        </section>
      )}

      {home.showContacts && (
        <section className="border-t border-line bg-ink-2 py-20 md:py-28">
          <Container className="grid gap-12 md:grid-cols-12">
            <div className="md:col-span-6">
              <p className="eyebrow mb-3">Contactos</p>
              <h2 className="display-title text-3xl text-white md:text-[2.6rem]">Fale connosco</h2>
              <p className="mt-4 max-w-md text-[0.98rem] leading-relaxed text-metal">
                Tem uma pergunta sobre uma viatura ou quer agendar uma visita? Envie-nos uma mensagem e responderemos com a maior brevidade.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href="/contactos" size="lg">
                  Enviar mensagem
                </LinkButton>
              </div>
              <SocialLinks social={settings.social} className="mt-8 flex items-center gap-2" />
            </div>
            <div className="md:col-span-6">
              <ContactDetails contact={settings.contact} />
            </div>
          </Container>
        </section>
      )}
    </>
  );
}
