import { ArrowRight, ChevronDown } from "lucide-react";
import { AdvantageIcon } from "@/components/site/advantage-icon";
import { ContactDetails } from "@/components/site/contact-details";
import { Container, PageHero, SectionHeading } from "@/components/site/section";
import { LinkButton } from "@/components/ui/button";
import { Markdown } from "@/lib/markdown";
import { useMeta, useShowroom } from "../showroom";

export function AboutPage() {
  const { settings, content } = useShowroom();
  const { about, advantages, faq } = content;
  useMeta(about.title || "O Stand", about.lead);

  return (
    <>
      <PageHero eyebrow={settings.brandName} title={about.title || "O Stand"} subtitle={about.lead} />
      {about.body && (
        <Container className="py-14 md:py-20">
          <div className="mx-auto max-w-3xl">
            <Markdown source={about.body} />
          </div>
        </Container>
      )}
      {advantages.items.length > 0 && (
        <section className="border-t border-line py-16 md:py-24">
          <Container>
            <SectionHeading eyebrow="Vantagens" title={advantages.title || "Porquê a Crew Car"} />
            <ul className="mt-12 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {advantages.items.map((a, i) => (
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
      {faq.items.length > 0 && (
        <section className="border-t border-line py-16 md:py-24">
          <Container className="grid gap-12 md:grid-cols-12">
            <div className="md:col-span-4">
              <SectionHeading eyebrow="Ajuda" title={faq.title || "Perguntas frequentes"} />
            </div>
            <div className="md:col-span-8">
              {faq.items.map((f, i) => (
                <details key={i} className="group border-b border-line py-5 first:border-t">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-base font-medium text-white [&::-webkit-details-marker]:hidden">
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
      <section className="border-t border-line bg-ink-2 py-16 md:py-24">
        <Container className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="display-title text-3xl text-white md:text-4xl">Visite-nos</h2>
            <p className="mt-4 max-w-md text-metal">Consulte as viaturas disponíveis ou fale connosco para marcar uma visita.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/viaturas" size="lg" icon={<ArrowRight className="size-4" />} className="flex-row-reverse">
                Ver viaturas
              </LinkButton>
              <LinkButton href="/contactos" size="lg" variant="secondary">
                Contactar
              </LinkButton>
            </div>
          </div>
          <ContactDetails contact={settings.contact} />
        </Container>
      </section>
    </>
  );
}
