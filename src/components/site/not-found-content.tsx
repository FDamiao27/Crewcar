import { ArrowRight } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export function NotFoundContent() {
  return (
    <section className="hero-backdrop flex min-h-[80svh] items-center pt-[var(--header-offset,4rem)]">
      <div className="mx-auto w-full max-w-7xl px-5 py-24 md:px-8">
        <p className="eyebrow">Erro 404</p>
        <h1 className="display-title mt-4 text-5xl text-white md:text-7xl">Página não encontrada.</h1>
        <p className="mt-6 max-w-lg text-metal">
          A página que procura não existe ou deixou de estar disponível. Se procurava uma viatura, é possível que já tenha sido vendida ou
          retirada do catálogo.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <LinkButton href="/viaturas" size="lg" icon={<ArrowRight className="size-4" />} className="flex-row-reverse">
            Ver viaturas disponíveis
          </LinkButton>
          <LinkButton href="/" size="lg" variant="secondary">
            Página inicial
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
