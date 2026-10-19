import type { Settings } from "@/lib/site-schema";

// Ícones vetoriais simples (desenhados em SVG) das redes sociais.
const paths: Record<keyof Settings["social"], { label: string; d: string }> = {
  facebook: {
    label: "Facebook",
    d: "M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v1.8H7.8v3.2h2.6V20h3.4v-8.3h2.7l.4-3.2H14z",
  },
  instagram: {
    label: "Instagram",
    d: "M12 7.4A4.6 4.6 0 1 0 12 16.6 4.6 4.6 0 0 0 12 7.4zm0 7.6a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm4.8-8.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM20 8.2c-.1-1.4-.4-2.7-1.4-3.7S16.3 3.1 14.9 3c-1.5-.1-5.9-.1-7.4 0-1.4.1-2.7.4-3.7 1.4S2.5 6.7 2.4 8.1c-.1 1.5-.1 5.9 0 7.4.1 1.4.4 2.7 1.4 3.7s2.3 1.3 3.7 1.4c1.5.1 5.9.1 7.4 0 1.4-.1 2.7-.4 3.7-1.4s1.3-2.3 1.4-3.7c.1-1.5.1-5.8 0-7.3zm-2 9.1c-.3.8-.9 1.4-1.7 1.7-1.2.5-3.9.4-5.2.4s-4 .1-5.2-.4c-.8-.3-1.4-.9-1.7-1.7-.5-1.2-.4-3.9-.4-5.2s-.1-4 .4-5.2c.3-.8.9-1.4 1.7-1.7 1.2-.5 3.9-.4 5.2-.4s4-.1 5.2.4c.8.3 1.4.9 1.7 1.7.5 1.2.4 3.9.4 5.2s.1 4-.4 5.2z",
  },
  youtube: {
    label: "YouTube",
    d: "M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z",
  },
  tiktok: {
    label: "TikTok",
    d: "M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9a7.4 7.4 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5z",
  },
  linkedin: {
    label: "LinkedIn",
    d: "M6.9 8.9H3.5V20h3.4V8.9zM5.2 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM20.5 13.6c0-3-1.6-4.9-4.3-4.9-1.4 0-2.4.8-2.8 1.5V8.9H10V20h3.4v-5.5c0-1.5.3-2.9 2.1-2.9s1.8 1.7 1.8 3V20h3.4l-.2-6.4z",
  },
};

export function SocialLinks({ social, className }: { social: Settings["social"]; className?: string }) {
  const entries = (Object.keys(paths) as (keyof Settings["social"])[]).filter((k) => social[k]);
  if (!entries.length) return null;
  return (
    <ul className={className ?? "flex items-center gap-2"} aria-label="Redes sociais">
      {entries.map((k) => (
        <li key={k}>
          <a
            href={social[k]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={paths[k].label}
            className="flex size-10 items-center justify-center rounded-full border border-line text-metal transition-colors duration-200 hover:border-white/60 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
              <path d={paths[k].d} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
