import Link from "next/link";
import { PUBLIC_PAGES } from "@/lib/constants";
import type { Content, Settings } from "@/lib/site-schema";
import { Logo } from "./logo";
import { SocialLinks } from "./social-icons";

export function SiteFooter({
  settings,
  content,
  legalSlugs,
}: {
  settings: Settings;
  content: Content;
  legalSlugs: string[];
}) {
  const { contact, company } = settings;
  const address = [contact.address.street, [contact.address.postalCode, contact.address.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const year = new Date().getFullYear();
  const legal = (Object.keys(PUBLIC_PAGES) as (keyof typeof PUBLIC_PAGES)[]).filter((s) => legalSlugs.includes(s));

  return (
    <footer className="border-t border-line bg-ink-2">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:grid-cols-12 md:px-8">
        <div className="md:col-span-5">
          <Logo brandName={settings.brandName} logo={settings.logo} />
          {(content.footer.text || settings.tagline) && (
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-metal">{content.footer.text || settings.tagline}</p>
          )}
          <SocialLinks social={settings.social} className="mt-6 flex items-center gap-2" />
        </div>

        <nav aria-label="Rodapé" className="md:col-span-3">
          <p className="eyebrow">Explorar</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link className="text-soft/80 hover:text-white" href="/viaturas">Viaturas</Link></li>
            <li><Link className="text-soft/80 hover:text-white" href="/o-stand">O Stand</Link></li>
            <li><Link className="text-soft/80 hover:text-white" href="/contactos">Contactos</Link></li>
          </ul>
        </nav>

        <div className="md:col-span-4">
          <p className="eyebrow">Contactos</p>
          <ul className="mt-4 space-y-2.5 text-sm text-soft/80">
            {contact.phone && (
              <li>
                <a className="hover:text-white" href={`tel:${contact.phone.replace(/\s/g, "")}`}>
                  {contact.phone}
                </a>
                {contact.phoneNote && <span className="block text-xs text-metal">{contact.phoneNote}</span>}
              </li>
            )}
            {contact.email && (
              <li>
                <a className="hover:text-white" href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              </li>
            )}
            {address && <li>{address}</li>}
            {!contact.phone && !contact.email && !address && (
              <li>
                <Link className="hover:text-white" href="/contactos">
                  Envie-nos uma mensagem
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 text-xs text-metal md:flex-row md:items-center md:justify-between md:px-8">
          <div className="space-y-1">
            <p>
              © {year} {company.legalName || settings.brandName}. Todos os direitos reservados.
            </p>
            {(company.nif || company.registeredOffice || company.licence) && (
              <p>
                {[
                  company.nif && `NIF ${company.nif}`,
                  company.registeredOffice && `Sede: ${company.registeredOffice}`,
                  company.licence,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {legal.map((slug) => (
              <li key={slug}>
                <Link className="hover:text-white" href={`/${slug}`}>
                  {PUBLIC_PAGES[slug]}
                </Link>
              </li>
            ))}
            {settings.cookies.bannerEnabled && (
              <li>
                <button type="button" data-cookie-preferences className="hover:text-white">
                  Preferências de cookies
                </button>
              </li>
            )}
            {company.complaintsBook && (
              <li>
                <a className="hover:text-white" href="https://www.livroreclamacoes.pt" target="_blank" rel="noopener noreferrer">
                  Livro de Reclamações
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
    </footer>
  );
}
