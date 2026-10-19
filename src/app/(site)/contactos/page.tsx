import type { Metadata } from "next";
import { ContactDetails } from "@/components/site/contact-details";
import { ContactForm } from "@/components/site/contact-form";
import { Container, PageHero } from "@/components/site/section";
import { SocialLinks } from "@/components/site/social-icons";
import { createFormToken } from "@/lib/form-token";
import { getPublishedPageSlugs, listAvailableForContact } from "@/lib/queries/public";
import { getSite } from "@/lib/queries/site";

export const metadata: Metadata = {
  title: "Contactos",
  description: "Fale com a Crew Car: envie-nos uma mensagem sobre uma viatura ou agende uma visita.",
  alternates: { canonical: "/contactos" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ContactPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [{ settings }, vehicles, legal] = await Promise.all([getSite(), listAvailableForContact(), getPublishedPageSlugs()]);
  const preselected = typeof sp.viatura === "string" ? vehicles.find((v) => v.id === sp.viatura) : undefined;
  const hasDetails =
    settings.contact.phone || settings.contact.email || settings.contact.whatsapp || settings.contact.address.street || settings.contact.openingHours;

  return (
    <>
      <PageHero
        eyebrow="Contactos"
        title="Fale connosco"
        subtitle="Tem uma pergunta sobre uma viatura ou quer agendar uma visita? Estamos disponíveis para ajudar."
      />
      <Container className="grid gap-14 py-14 md:py-20 lg:grid-cols-12 lg:gap-16">
        <section aria-labelledby="formulario" className="lg:col-span-7">
          <h2 id="formulario" className="text-xl font-semibold text-white">
            Enviar mensagem
          </h2>
          <p className="mt-1.5 mb-8 text-sm text-metal">Os campos assinalados com * são obrigatórios.</p>
          <ContactForm
            token={createFormToken()}
            vehicle={preselected}
            vehicles={vehicles}
            source="pagina_contactos"
            privacyPage={legal.includes("privacidade")}
          />
        </section>

        <aside aria-label="Dados de contacto" className="lg:col-span-5">
          <div className="rounded-sm surface p-7">
            {hasDetails ? (
              <ContactDetails contact={settings.contact} />
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
