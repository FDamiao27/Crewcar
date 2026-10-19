"use client";

import { Car, ExternalLink, FileText, Inbox, LayoutDashboard, LogOut, Menu, Settings, Tag, UserCog, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { logout } from "@/app/admin/actions/auth";
import { ROLES, type Role } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: ReactNode; badge?: number };

export function AdminShell({
  logo,
  user,
  items,
  children,
}: {
  logo: ReactNode;
  user: { name: string; role: Role };
  items: { key: string; badge?: number }[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const all: Record<string, Item> = {
    dashboard: { href: "/admin", label: "Painel", icon: <LayoutDashboard /> },
    vehicles: { href: "/admin/viaturas", label: "Viaturas", icon: <Car /> },
    prices: { href: "/admin/precos", label: "Preços e descontos", icon: <Tag /> },
    leads: { href: "/admin/contactos", label: "Contactos", icon: <Inbox /> },
    content: { href: "/admin/conteudos", label: "Conteúdos", icon: <FileText /> },
    settings: { href: "/admin/definicoes", label: "Definições", icon: <Settings /> },
    users: { href: "/admin/utilizadores", label: "Utilizadores", icon: <Users /> },
  };
  const nav = items.map((i) => ({ ...all[i.key], badge: i.badge }));
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/admin" aria-label="Painel">
          {logo}
        </Link>
        <button type="button" className="text-metal md:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu">
          <X className="size-5" />
        </button>
      </div>
      <nav aria-label="Back office" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition-colors [&_svg]:size-[18px] [&_svg]:stroke-[1.5]",
                  isActive(item.href) ? "bg-white/[0.08] text-white" : "text-metal hover:bg-white/[0.04] hover:text-white",
                )}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {!!item.badge && (
                  <span className="rounded-full bg-white px-1.5 py-px text-[0.65rem] font-semibold text-ink tabular" aria-label={`${item.badge} novos`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-line p-3">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-metal hover:text-white [&_svg]:size-4"
        >
          <ExternalLink /> Ver website
        </a>
        <Link
          href="/admin/conta"
          className={cn(
            "flex items-center gap-3 rounded-sm px-3 py-2 text-sm [&_svg]:size-4",
            isActive("/admin/conta") ? "text-white" : "text-metal hover:text-white",
          )}
        >
          <UserCog /> A minha conta
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2 rounded-sm bg-white/[0.03] px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-metal">{ROLES[user.role]}</p>
          </div>
          <form action={logout}>
            <button type="submit" className="rounded-sm p-1.5 text-metal hover:bg-white/[0.06] hover:text-white" aria-label="Terminar sessão" title="Terminar sessão">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-ink md:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-ink-2 md:block">{sidebar}</aside>

      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-ink/90 px-4 backdrop-blur md:hidden">
        <Link href="/admin">{logo}</Link>
        <button type="button" onClick={() => setOpen(true)} className="p-2 text-white" aria-label="Abrir menu" aria-expanded={open}>
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-label="Fechar menu" />
          <aside className="absolute inset-y-0 left-0 w-72 animate-fade-in border-r border-line bg-ink-2">{sidebar}</aside>
        </div>
      )}

      <main id="conteudo" className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-block text-xs text-metal hover:text-white">
            ← {back.label}
          </Link>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-white md:text-[1.7rem]">{title}</h1>
        {description && <div className="mt-1 text-sm text-metal">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
