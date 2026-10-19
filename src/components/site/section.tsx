import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-5 md:px-8", className)}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
  as: Tag = "h2",
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <Tag className={cn("display-title text-white", Tag === "h1" ? "text-4xl md:text-6xl" : "text-3xl md:text-[2.6rem]")}>
          {title}
        </Tag>
        {subtitle && <p className="mt-4 text-[0.98rem] leading-relaxed text-metal">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Cabeçalho das páginas interiores (compensa o cabeçalho fixo). */
export function PageHero({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <section className="hero-backdrop border-b border-line pt-[calc(var(--header-offset)+3.5rem)] pb-12 md:pb-16">
      <Container>
        <div className="animate-fade-up">
          <SectionHeading as="h1" eyebrow={eyebrow} title={title} subtitle={subtitle} />
          {children}
        </div>
      </Container>
    </section>
  );
}
