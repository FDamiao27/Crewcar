"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/button";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="hero-backdrop flex min-h-[70svh] items-center pt-[var(--header-offset)]">
      <div className="mx-auto w-full max-w-7xl px-5 py-24 md:px-8">
        <p className="eyebrow">Erro</p>
        <h1 className="display-title mt-4 text-4xl text-white md:text-6xl">Algo correu mal.</h1>
        <p className="mt-6 max-w-lg text-metal">Não foi possível carregar esta página. Tente novamente dentro de instantes.</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button size="lg" onClick={reset} icon={<RotateCcw className="size-4" />}>
            Tentar novamente
          </Button>
          <LinkButton href="/" size="lg" variant="secondary">
            Página inicial
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
