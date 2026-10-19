"use client";

import { Menu, Phone, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/viaturas", label: "Viaturas" },
  { href: "/o-stand", label: "O Stand" },
  { href: "/contactos", label: "Contactos" },
];

export function SiteHeader({ logo, brandName, phone, banner }: { logo: ReactNode; brandName: string; phone?: string; banner?: ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const overHero = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const first = menuRef.current?.querySelector<HTMLElement>("a,button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const solid = scrolled || open || !overHero;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300",
        solid ? "border-b border-line bg-ink/85 backdrop-blur-xl" : "border-b border-transparent bg-transparent",
      )}
    >
      {banner}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 md:h-[4.5rem] md:px-8">
        <Link href="/" className="-m-2 p-2" title={`${brandName} — página inicial`}>
          {logo}
        </Link>

        <nav aria-label="Navegação principal" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "relative px-3.5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.16em] transition-colors duration-200",
                    isActive(item.href) ? "text-white" : "text-metal hover:text-white",
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      "absolute inset-x-3.5 -bottom-px h-px origin-left bg-white transition-transform duration-300",
                      isActive(item.href) ? "scale-x-100" : "scale-x-0",
                    )}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/contactos" className={cn(buttonClass("secondary", "sm"), "hidden md:inline-flex")}>
            Contactar
          </Link>
          <button
            ref={toggleRef}
            type="button"
            className="-mr-2 flex size-10 items-center justify-center rounded-sm text-white md:hidden"
            aria-expanded={open}
            aria-controls="menu-movel"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <div
        id="menu-movel"
        ref={menuRef}
        hidden={!open}
        className="h-[calc(100dvh-var(--header-offset))] animate-fade-in overflow-y-auto border-t border-line bg-ink px-5 pt-6 pb-10 md:hidden"
      >
        <nav aria-label="Navegação móvel">
          <ul className="flex flex-col">
            {NAV.map((item) => (
              <li key={item.href} className="border-b border-line">
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between py-5 text-2xl font-semibold uppercase tracking-tight",
                    isActive(item.href) ? "text-white" : "text-soft/70",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/contactos" className={buttonClass("primary", "lg")}>
            Falar com a Crew Car
          </Link>
          {phone && (
            <a href={`tel:${phone.replace(/\s/g, "")}`} className={buttonClass("secondary", "lg")}>
              <Phone className="size-4" /> {phone}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
