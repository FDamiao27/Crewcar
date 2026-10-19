"use client";

import { Check, Link2, Mail, Share2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copie a ligação:", url);
    }
  };

  const native = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* partilha cancelada */
      }
    } else copy();
  };

  const item = "flex size-10 items-center justify-center rounded-full border border-line text-metal transition-colors hover:border-white/60 hover:text-white";

  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow mr-1 !text-[0.6rem]">Partilhar</span>
      <button type="button" onClick={native} className={cn(item, "sm:hidden")} aria-label="Partilhar anúncio">
        <Share2 className="size-4" />
      </button>
      <a
        className={cn(item, "hidden sm:flex")}
        href={`https://wa.me/?text=${enc(`${title} — ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Partilhar no WhatsApp"
      >
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.2.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.6-.3z" />
        </svg>
      </a>
      <a
        className={cn(item, "hidden sm:flex")}
        href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Partilhar no Facebook"
      >
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
          <path d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v1.8H7.8v3.2h2.6V20h3.4v-8.3h2.7l.4-3.2H14z" />
        </svg>
      </a>
      <a className={cn(item, "hidden sm:flex")} href={`mailto:?subject=${enc(title)}&body=${enc(url)}`} aria-label="Partilhar por e-mail">
        <Mail className="size-4" />
      </a>
      <button type="button" onClick={copy} className={item} aria-label={copied ? "Ligação copiada" : "Copiar ligação"}>
        {copied ? <Check className="size-4 text-ok" /> : <Link2 className="size-4" />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Ligação copiada para a área de transferência" : ""}
      </span>
    </div>
  );
}
