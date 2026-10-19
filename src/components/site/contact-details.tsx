import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { whatsappDigits, type Settings } from "@/lib/site-schema";

export function formatAddress(a: Settings["contact"]["address"]): string {
  return [a.street, [a.postalCode, a.city].filter(Boolean).join(" "), a.country && a.street ? a.country : ""]
    .filter(Boolean)
    .join(", ");
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-line py-5 first:pt-0 last:border-0">
      <div className="mt-0.5 text-metal [&_svg]:size-[18px] [&_svg]:stroke-[1.4]">{icon}</div>
      <div className="min-w-0">
        <p className="eyebrow !text-[0.6rem]">{label}</p>
        <div className="mt-1.5 text-[0.95rem] text-white">{children}</div>
      </div>
    </div>
  );
}

/** Lista de contactos — mostra apenas os dados efetivamente configurados no back office. */
export function ContactDetails({ contact }: { contact: Settings["contact"] }) {
  const address = formatAddress(contact.address);
  const hasAny = contact.phone || contact.email || contact.whatsapp || address || contact.openingHours;
  if (!hasAny) return null;
  return (
    <div>
      {contact.phone && (
        <Row icon={<Phone />} label="Telefone">
          <a className="hover:underline" href={`tel:${contact.phone.replace(/\s/g, "")}`}>
            {contact.phone}
          </a>
          {contact.phoneNote && <span className="mt-0.5 block text-xs text-metal">{contact.phoneNote}</span>}
        </Row>
      )}
      {contact.whatsapp && (
        <Row icon={<MessageCircle />} label="WhatsApp">
          <a className="hover:underline" href={`https://wa.me/${whatsappDigits(contact.whatsapp)}`} target="_blank" rel="noopener noreferrer">
            {contact.whatsapp}
          </a>
        </Row>
      )}
      {contact.email && (
        <Row icon={<Mail />} label="E-mail">
          <a className="break-all hover:underline" href={`mailto:${contact.email}`}>
            {contact.email}
          </a>
        </Row>
      )}
      {address && (
        <Row icon={<MapPin />} label="Morada">
          <address className="not-italic">{address}</address>
          {contact.mapUrl && (
            <a
              href={contact.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-block text-xs font-semibold uppercase tracking-[0.14em] text-metal hover:text-white"
            >
              Ver no mapa ↗
            </a>
          )}
        </Row>
      )}
      {contact.openingHours && (
        <Row icon={<Clock />} label="Horário">
          <p className="whitespace-pre-line text-soft/90">{contact.openingHours}</p>
        </Row>
      )}
    </div>
  );
}
