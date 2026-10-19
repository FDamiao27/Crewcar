import { ArrowLeft, ExternalLink, MessageCircle, Phone, PlayCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "react-router";
import { Gallery } from "@/components/site/gallery";
import { PriceBlock } from "@/components/site/price-block";
import { Container, SectionHeading } from "@/components/site/section";
import { ShareButtons } from "@/components/site/share";
import { VehicleGrid } from "@/components/site/vehicle-card";
import { photoSrc } from "@/components/site/vehicle-image";
import { buttonClass } from "@/components/ui/button";
import { Badge, Notice } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { CATEGORIES, CONDITIONS, FUELS, LINK_KINDS, TRANSMISSIONS, label } from "@/lib/constants";
import { formatDate, formatEngine, formatKm, formatNumber, formatPower, formatPrice } from "@/lib/format";
import { whatsappDigits } from "@/lib/site-schema";
import { similarVehicles } from "../catalog";
import { ContactForm } from "../components/contact-form";
import { absoluteUrl } from "../config";
import { useMeta, useShowroom } from "../showroom";
import { NotFoundPage } from "./not-found";

export function VehiclePage() {
  const { slug } = useParams();
  const { settings, vehicles, pages } = useShowroom();
  const v = vehicles.find((x) => x.slug === slug);
  const hidden = !v || (v.status === "vendido" && !settings.publishing.keepSoldPages);
  const title = v ? [v.brand, v.model, v.version].filter(Boolean).join(" ") : "";
  useMeta(
    hidden ? "Página não encontrada" : v.seoTitle || `${title}${v.registrationYear ? ` (${v.registrationYear})` : ""}`,
    hidden ? null : v.seoDescription || v.shortDescription || `${title} — ${[v.registrationYear, v.mileageKm !== null ? formatKm(v.mileageKm) : null, label(FUELS, v.fuel), v.pricing.finalPriceCents ? formatPrice(v.pricing.finalPriceCents) : null].filter(Boolean).join(" · ")}.`,
  );
  if (hidden) return <NotFoundPage />;

  const similar = similarVehicles(vehicles, v, settings.publishing.similarCount);
  const url = absoluteUrl(`/viaturas/${v.slug}`);
  const tz = settings.regional.timezone;
  const sold = v.status === "vendido";
  const wa = settings.contact.whatsapp
    ? `https://wa.me/${whatsappDigits(settings.contact.whatsapp)}?text=${encodeURIComponent(`${settings.publishing.whatsappMessage} ${title} (Ref. ${v.reference}) — ${url}`)}`
    : null;

  const specs: [string, string | null][] = [
    ["Marca", v.brand],
    ["Modelo", v.model],
    ["Versão", v.version],
    ["Categoria", label(CATEGORIES, v.category)],
    ["Estado", label(CONDITIONS, v.condition)],
    ["Ano", v.registrationYear ? String(v.registrationYear) : null],
    ["1.ª matrícula", v.firstRegistrationDate ? formatDate(v.firstRegistrationDate, tz) : null],
    ["Quilometragem", v.mileageKm !== null ? formatKm(v.mileageKm) : null],
    ["Combustível", label(FUELS, v.fuel)],
    ["Caixa", label(TRANSMISSIONS, v.transmission)],
    ["Cilindrada", formatEngine(v.engineCc)],
    ["Potência", formatPower(v.powerHp)],
    ["Cor exterior", v.exteriorColor],
    ["Cor interior", v.interiorColor],
    ["Portas", v.doors ? formatNumber(v.doors) : null],
    ["Lugares", v.seats ? formatNumber(v.seats) : null],
    ["Referência", v.reference],
  ];
  const keyFacts = [
    { k: "Ano", v: v.registrationYear ? String(v.registrationYear) : null },
    { k: "Quilómetros", v: v.mileageKm !== null ? formatKm(v.mileageKm) : null },
    { k: "Combustível", v: label(FUELS, v.fuel) },
    { k: "Caixa", v: label(TRANSMISSIONS, v.transmission) },
    { k: "Potência", v: formatPower(v.powerHp) },
    { k: "Cilindrada", v: formatEngine(v.engineCc) },
  ].filter((x) => x.v);

  const carLd = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: title,
    url,
    brand: { "@type": "Brand", name: v.brand },
    model: v.model,
    ...(v.registrationYear && { vehicleModelDate: String(v.registrationYear) }),
    ...(v.mileageKm !== null && { mileageFromOdometer: { "@type": "QuantitativeValue", value: v.mileageKm, unitCode: "KMT" } }),
    ...(v.fuel && { fuelType: label(FUELS, v.fuel) }),
    ...(v.transmission && { vehicleTransmission: label(TRANSMISSIONS, v.transmission) }),
    image: v.photos.slice(0, 8).map((p) => photoSrc(p, 1200)),
    ...(v.pricing.finalPriceCents && {
      offers: {
        "@type": "Offer",
        price: (v.pricing.finalPriceCents / 100).toFixed(2),
        priceCurrency: "EUR",
        availability: sold ? "https://schema.org/SoldOut" : v.status === "reservado" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock",
        url,
      },
    }),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(carLd).replace(/</g, "\\u003c") }} />
      <div className="pt-[calc(var(--header-offset)+1.5rem)]">
        <Container>
          <nav aria-label="Navegação estrutural" className="flex items-center gap-2 text-xs text-metal">
            <Link href="/viaturas" className="inline-flex items-center gap-1.5 hover:text-white">
              <ArrowLeft className="size-3.5" /> Viaturas
            </Link>
            <span aria-hidden="true">/</span>
            <span className="truncate text-soft/80" aria-current="page">
              {v.brand} {v.model}
            </span>
          </nav>
        </Container>

        <Container className="mt-6 grid gap-10 pb-16 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7 xl:col-span-8">
            <Gallery photos={v.photos} title={title} />
          </div>
          <aside className="lg:col-span-5 xl:col-span-4">
            <div className="lg:sticky lg:top-[calc(var(--header-offset)+1.5rem)]">
              <div className="flex flex-wrap gap-1.5">
                {v.status === "disponivel" && <Badge tone="ok">Disponível</Badge>}
                {v.status === "reservado" && <Badge tone="warn">Reservado</Badge>}
                {sold && <Badge tone="neutral">Vendido</Badge>}
                {v.condition && <Badge>{label(CONDITIONS, v.condition)}</Badge>}
                {v.isDemo && <Badge tone="warn">Conteúdo de demonstração</Badge>}
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-[2.2rem] md:leading-tight">
                {v.brand} {v.model}
              </h1>
              {v.version && <p className="mt-1 text-base text-metal">{v.version}</p>}

              {!sold && <PriceBlock pricing={v.pricing} size="lg" showEnd timeZone={tz} className="mt-6 border-t border-line pt-6" />}
              {v.pricing.hasDiscount && !sold && (
                <p className="mt-2 text-[0.7rem] leading-relaxed text-metal/80">Preço anterior: preço mais baixo praticado nos 30 dias anteriores à redução.</p>
              )}

              {keyFacts.length > 0 && (
                <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line">
                  {keyFacts.map((f) => (
                    <div key={f.k} className="bg-ink px-4 py-3">
                      <dt className="eyebrow !text-[0.58rem]">{f.k}</dt>
                      <dd className="mt-1 text-sm font-medium text-white tabular">{f.v}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {sold ? (
                <Notice className="mt-6" title="Viatura vendida">
                  Esta viatura já foi vendida. Veja abaixo viaturas semelhantes ou contacte-nos.
                </Notice>
              ) : (
                <div className="mt-6 flex flex-col gap-2.5">
                  {v.status === "reservado" && (
                    <p className="mb-1 text-xs text-metal">Esta viatura está reservada. Deixe o seu contacto para ser informado caso volte a ficar disponível.</p>
                  )}
                  <a href="#contacto" className={buttonClass("primary", "lg")}>
                    Pedir informações
                  </a>
                  <div className="grid grid-cols-2 gap-2.5">
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(buttonClass("secondary", "lg"), !settings.contact.phone && "col-span-2")}>
                        <MessageCircle className="size-4" /> WhatsApp
                      </a>
                    )}
                    {settings.contact.phone && (
                      <a href={`tel:${settings.contact.phone.replace(/\s/g, "")}`} className={cn(buttonClass("secondary", "lg"), !wa && "col-span-2")}>
                        <Phone className="size-4" /> Ligar
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
                <ShareButtons url={url} title={title} />
                <p className="text-xs text-metal">
                  Ref. <span className="text-soft tabular">{v.reference}</span>
                </p>
              </div>
            </div>
          </aside>
        </Container>
      </div>

      <div className="border-t border-line">
        <Container className="grid gap-14 py-16 lg:grid-cols-12 lg:gap-12">
          <div className="space-y-14 lg:col-span-7 xl:col-span-8">
            {(v.shortDescription || v.description) && (
              <section aria-labelledby="descricao">
                <h2 id="descricao" className="eyebrow">
                  Descrição
                </h2>
                {v.shortDescription && <p className="mt-4 text-lg leading-relaxed text-white">{v.shortDescription}</p>}
                {v.description && <div className="prose-cc mt-4 whitespace-pre-line">{v.description}</div>}
              </section>
            )}

            <section aria-labelledby="caracteristicas">
              <h2 id="caracteristicas" className="eyebrow">
                Características técnicas
              </h2>
              <dl className="mt-5 grid sm:grid-cols-2 sm:gap-x-10">
                {specs
                  .filter(([, value]) => value)
                  .map(([k, value]) => (
                    <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line py-3">
                      <dt className="text-sm text-metal">{k}</dt>
                      <dd className="text-right text-sm font-medium text-white tabular">{value}</dd>
                    </div>
                  ))}
              </dl>
            </section>

            {(v.equipment.length > 0 || v.extras.length > 0) && (
              <section aria-labelledby="equipamento" className="grid gap-10 sm:grid-cols-2">
                {v.equipment.length > 0 && (
                  <div>
                    <h2 id="equipamento" className="eyebrow">
                      Equipamento
                    </h2>
                    <ul className="mt-5 space-y-2.5">
                      {v.equipment.map((item, i) => (
                        <li key={i} className="flex gap-3 text-sm text-soft/90">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-metal" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {v.extras.length > 0 && (
                  <div>
                    <h2 className="eyebrow">Extras</h2>
                    <ul className="mt-5 space-y-2.5">
                      {v.extras.map((item, i) => (
                        <li key={i} className="flex gap-3 text-sm text-soft/90">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-white" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {v.warrantyVerified && v.warrantyInfo && (
              <section aria-labelledby="garantia" className="flex gap-4 rounded-sm surface p-6">
                <ShieldCheck className="size-6 shrink-0 text-white" strokeWidth={1.4} aria-hidden="true" />
                <div>
                  <h2 id="garantia" className="text-base font-semibold text-white">
                    Garantia
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-soft/85">{v.warrantyInfo}</p>
                </div>
              </section>
            )}

            {v.commercialInfo && (
              <section aria-labelledby="info-comercial">
                <h2 id="info-comercial" className="eyebrow">
                  Informação adicional
                </h2>
                <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-soft/85">{v.commercialInfo}</p>
              </section>
            )}

            {(v.videoUrl || v.links.length > 0) && (
              <section aria-labelledby="ligacoes">
                <h2 id="ligacoes" className="eyebrow">
                  Ligações
                </h2>
                <ul className="mt-5 flex flex-wrap gap-2.5">
                  {v.videoUrl && (
                    <li>
                      <a href={v.videoUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "md")}>
                        <PlayCircle className="size-4" /> Ver vídeo
                      </a>
                    </li>
                  )}
                  {v.links.map((l) => (
                    <li key={l.id}>
                      <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className={buttonClass("secondary", "md")}>
                        <ExternalLink className="size-4" /> {l.label || LINK_KINDS[l.kind]}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <section id="contacto" aria-labelledby="titulo-contacto" className="scroll-mt-28 lg:col-span-5 xl:col-span-4">
            <div className="rounded-sm surface p-6 md:p-7">
              <h2 id="titulo-contacto" className="text-lg font-semibold text-white">
                {sold ? "Procura uma viatura semelhante?" : "Interessado nesta viatura?"}
              </h2>
              <p className="mt-1.5 mb-6 text-sm text-metal">Envie-nos uma mensagem e entraremos em contacto consigo.</p>
              <ContactForm
                key={v.id}
                vehicle={{ id: v.id, label: `${title} · Ref. ${v.reference}` }}
                source="pagina_viatura"
                privacyPage={pages.some((p) => p.slug === "privacidade")}
                defaultMessage={sold ? "" : `Olá! Gostaria de obter mais informações sobre o ${title}.`}
              />
            </div>
          </section>
        </Container>
      </div>

      {similar.length > 0 && (
        <section className="border-t border-line bg-ink-2 py-16 md:py-24" aria-labelledby="semelhantes">
          <Container>
            <SectionHeading eyebrow="Sugestões" title="Viaturas semelhantes" />
            <div className="mt-10">
              <VehicleGrid vehicles={similar} />
            </div>
          </Container>
        </section>
      )}
    </>
  );
}
