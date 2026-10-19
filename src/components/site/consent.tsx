"use client";

import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const COOKIE = "cc_consent";
type Consent = "accepted" | "rejected" | null;

function readConsent(): Consent {
  const match = document.cookie.match(/(?:^|; )cc_consent=(accepted|rejected)/);
  return (match?.[1] as Consent) ?? null;
}

function writeConsent(value: Exclude<Consent, null>) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${value}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax${secure}`;
}

type Analytics = { provider: "none" | "plausible" | "ga4"; plausibleDomain: string; ga4Id: string };

/**
 * Banner de consentimento de cookies. As ferramentas de análise só são carregadas
 * depois de o visitante aceitar; rejeitar é tão fácil como aceitar.
 */
export function CookieConsent({
  enabled,
  message,
  analytics,
  nonce,
  hasCookiePage,
}: {
  enabled: boolean;
  message: string;
  analytics: Analytics;
  nonce?: string;
  hasCookiePage: boolean;
}) {
  const [consent, setConsent] = useState<Consent>(null);
  const [visible, setVisible] = useState(false);
  const analyticsActive = analytics.provider !== "none" && (analytics.plausibleDomain || analytics.ga4Id);

  useEffect(() => {
    const c = readConsent();
    setConsent(c);
    if (enabled && c === null) setVisible(true);
  }, [enabled]);

  useEffect(() => {
    const open = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest?.("[data-cookie-preferences]")) setVisible(true);
    };
    document.addEventListener("click", open);
    return () => document.removeEventListener("click", open);
  }, []);

  const choose = useCallback((value: Exclude<Consent, null>) => {
    writeConsent(value);
    setConsent(value);
    setVisible(false);
    if (value === "rejected" && readConsent() === "rejected") {
      // Remover cookies de análise previamente definidos
      for (const name of document.cookie.split("; ").map((c) => c.split("=")[0])) {
        if (/^(_ga|_gid|_gat)/.test(name)) document.cookie = `${name}=; Max-Age=0; Path=/`;
      }
    }
  }, []);

  const loadAnalytics = consent === "accepted" || (!enabled && analyticsActive);

  return (
    <>
      {loadAnalytics && analytics.provider === "plausible" && analytics.plausibleDomain && (
        <Script
          nonce={nonce}
          src="https://plausible.io/js/script.js"
          data-domain={analytics.plausibleDomain}
          strategy="afterInteractive"
        />
      )}
      {loadAnalytics && analytics.provider === "ga4" && analytics.ga4Id && (
        <>
          <Script nonce={nonce} src={`https://www.googletagmanager.com/gtag/js?id=${analytics.ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4-init" nonce={nonce} strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(analytics.ga4Id)},{anonymize_ip:true});`}
          </Script>
        </>
      )}

      {enabled && visible && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Consentimento de cookies"
          className="fixed inset-x-3 bottom-3 z-[90] animate-fade-up rounded-sm border border-line-strong bg-ink-2/95 p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-md"
        >
          <p className="eyebrow">Cookies</p>
          <p className="mt-2 text-sm leading-relaxed text-soft/85">
            {message}{" "}
            {hasCookiePage && (
              <Link href="/cookies" className="text-white underline underline-offset-2">
                Saber mais
              </Link>
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => choose("accepted")}>
              Aceitar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => choose("rejected")}>
              Rejeitar
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
