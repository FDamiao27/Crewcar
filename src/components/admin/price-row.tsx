"use client";

import { Check, ChevronDown, ExternalLink, Pencil, X } from "lucide-react";
import { useState, useTransition } from "react";
import { updateBasePrice } from "@/app/admin/actions/vehicles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { inputClass } from "@/components/ui/styles";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { VehicleStatus } from "@/lib/constants";
import { centsToInput, formatPercent, formatPrice } from "@/lib/format";
import { describePromotion, type Pricing } from "@/lib/pricing";
import { PricingPanel, type PanelHistory, type PanelPromotion } from "./pricing-panel";
import { VehicleStatusBadge } from "./ui";

const td = "border-b border-line px-4 py-3 align-middle text-soft";

export function PriceRow({
  vehicle,
  pricing,
  promotions,
  history,
  timeZone,
}: {
  vehicle: { id: string; slug: string; title: string; reference: string; status: VehicleStatus; isPublished: boolean; priceCents: number | null; scheduled: boolean };
  pricing: Pricing;
  promotions: PanelPromotion[];
  history: PanelHistory[];
  timeZone: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(centsToInput(vehicle.priceCents));
  const [saving, start] = useTransition();

  const save = () =>
    start(async () => {
      const r = await updateBasePrice(vehicle.id, value);
      if (r.ok) {
        toast(r.message ?? "Preço atualizado.");
        setEditing(false);
      } else toast(r.message, "error");
    });

  return (
    <tbody>
      <tr className="hover:bg-white/[0.015]">
        <td className={td}>
          <p className="font-medium text-white">{vehicle.title}</p>
          <p className="text-xs text-metal tabular">{vehicle.reference}</p>
        </td>
        <td className={td}>
          <VehicleStatusBadge status={vehicle.status} />
        </td>
        <td className={cn(td, "text-right whitespace-nowrap")}>
          {editing ? (
            <div className="flex items-center justify-end gap-1">
              <label htmlFor={`p-${vehicle.id}`} className="sr-only">
                Novo preço de {vehicle.title}
              </label>
              <input
                id={`p-${vehicle.id}`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") setEditing(false);
                }}
                inputMode="decimal"
                autoFocus
                className={cn(inputClass, "h-8 w-28 py-1 text-right text-sm")}
              />
              <Button size="sm" variant="subtle" onClick={save} loading={saving} aria-label="Guardar preço" className="px-2">
                <Check className="size-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancelar" className="px-2">
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setValue(centsToInput(vehicle.priceCents));
                setEditing(true);
              }}
              className="group inline-flex items-center gap-2 tabular hover:text-white"
              aria-label={`Alterar preço de ${vehicle.title}`}
            >
              {formatPrice(vehicle.priceCents)}
              <Pencil className="size-3 text-metal opacity-0 group-hover:opacity-100" />
            </button>
          )}
        </td>
        <td className={td}>
          {pricing.activePromotion ? (
            <span className="text-sm">{describePromotion(pricing.activePromotion, formatPrice)}</span>
          ) : vehicle.scheduled ? (
            <Badge tone="outline">Agendada</Badge>
          ) : (
            <span className="text-metal">—</span>
          )}
        </td>
        <td className={cn(td, "text-right font-medium whitespace-nowrap text-white tabular")}>{formatPrice(pricing.finalPriceCents)}</td>
        <td className={cn(td, "text-right whitespace-nowrap tabular")}>
          {pricing.hasDiscount ? (
            <>
              {formatPrice(pricing.savingsCents)} <span className="text-metal">({formatPercent(pricing.savingsPercent)})</span>
            </>
          ) : (
            <span className="text-metal">—</span>
          )}
        </td>
        <td className={cn(td, "text-right whitespace-nowrap")}>
          <div className="flex items-center justify-end gap-1">
            <a
              href={`/viaturas/${vehicle.slug}${vehicle.isPublished ? "" : "?preview=1"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm p-1.5 text-metal hover:text-white"
              aria-label={`Ver ${vehicle.title} no showroom`}
              title="Ver no showroom"
            >
              <ExternalLink className="size-4" />
            </a>
            <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open} icon={<ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />}>
              Gerir
            </Button>
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="border-b border-line bg-ink-2/60 px-4 py-6 md:px-6">
            <PricingPanel
              vehicleId={vehicle.id}
              basePriceCents={vehicle.priceCents}
              pricing={pricing}
              promotions={promotions}
              history={history}
              timeZone={timeZone}
              disabled={vehicle.status === "vendido"}
              disabledReason="Não é possível criar promoções para viaturas vendidas."
            />
          </td>
        </tr>
      )}
    </tbody>
  );
}
