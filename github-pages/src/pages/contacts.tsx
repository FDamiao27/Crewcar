import { useSearchParams } from "react-router";
import { ContactDetails } from "@/components/site/contact-details";
import { Container, PageHero } from "@/components/site/section";
import { SocialLinks } from "@/components/site/social-icons";
import { ContactForm } from "../components/contact-form";
import { useMeta, useShowroom } from "../showroom";

export function ContactPage() {
  const { settings, vehicles, pages } = useShowroom();
  const [sp] = useSearchParams();
  useMeta("Contactos", "Fale com a Crew Car: envie-nos uma mensagem sobre uma viatura ou agende uma visita.");
  const options = vehicles
    .filter((v) => v.status !== "vendido")
    .sort((a, b) => a.brand.localeCompare(b.brand, "pt") || a.model.localeCompare(b.model, "pt"))
    .map((v) => ({ id: v.id, label: `${v.brand} ${v.model}${v.version ? ` ${v.version}` : ""} (${v.reference})` }));
  const preselected = options.find((o) => o.id === sp.get("viatura"));
  const c = settings.contact;
  const hasDetails = c.phone || c.email || c.whatsapp || c.address.street || c.openingHours;

  return (
    <>
      <PageHero eyebrow="Contactos" title="Fale connosco" subtitle="Tem uma pergunta sobre uma viatura ou quer agendar uma visita? Estamos disponíveis para ajudar." />
      <Container className="grid gap-14 py-14 md:py-20 lg:grid-cols-12 lg:gap-16">
        <section aria-labelledby="formulario" className="lg:col-span-7">
          <h2 id="formulario" className="text-xl font-semibold text-white">
            Enviar mensagem
          </h2>
          <p className="mt-1.5 mb-8 text-sm text-metal">Os campos assinalados com * são obrigatórios.</p>
          <ContactForm vehicle={preselected} vehicles={options} source="pagina_contactos" privacyPage={pages.some((p) => p.slug === "privacidade")} />
        </section>
        <aside aria-label="Dados de contacto" className="lg:col-span-5">
          <div className="rounded-sm surface p-7">
            {hasDetails ? (
              <ContactDetails contact={c} />
            ) : (
              <p className="text-sm text-metal">Utilize o formulário para nos contactar — responderemos com a maior brevidade.</p>
            )}
            <SocialLinks social={settings.social} className="mt-6 flex items-center gap-2 border-t border-line pt-6" />
          </div>
        </aside>
      </Container>
    </>
  );
}
