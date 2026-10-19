import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/misc";
import { FUELS, TRANSMISSIONS, label } from "@/lib/constants";
import { formatKm, formatPercent } from "@/lib/format";
import type { VehicleCard as VehicleCardData } from "@/lib/queries/public";
import { PriceBlock } from "./price-block";
import { PhotoPlaceholder, VehicleImage } from "./vehicle-image";

export function vehicleTitle(v: { brand: string; model: string }) {
  return `${v.brand} ${v.model}`;
}

export function VehicleCard({ vehicle: v, priority }: { vehicle: VehicleCardData; priority?: boolean }) {
  const specs = [
    v.registrationYear ? String(v.registrationYear) : null,
    v.mileageKm !== null ? formatKm(v.mileageKm) : null,
    label(FUELS, v.fuel),
    label(TRANSMISSIONS, v.transmission),
  ].filter(Boolean) as string[];

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-sm surface transition-[border-color,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-white/20">
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-2">
        {v.photo ? (
          <VehicleImage
            photo={v.photo}
            alt={`${vehicleTitle(v)}${v.version ? ` ${v.version}` : ""}`}
            priority={priority}
            className="transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <PhotoPlaceholder />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-wrap gap-1.5">
            {v.status === "reservado" && <Badge tone="outline">Reservado</Badge>}
            {v.status === "vendido" && <Badge tone="outline">Vendido</Badge>}
            {v.isDemo && <Badge tone="warn">Demonstração</Badge>}
          </div>
          {v.pricing.hasDiscount && <Badge tone="light">−{formatPercent(v.pricing.savingsPercent)}</Badge>}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="min-w-0">
          <h3 className="truncate text-[1.02rem] font-semibold tracking-tight text-white">
            <Link href={`/viaturas/${v.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
              {vehicleTitle(v)}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-sm text-metal">{v.version || " "}</p>
        </div>

        {specs.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.78rem] text-soft/75" aria-label="Características principais">
            {specs.map((s, i) => (
              <li key={i} className="flex items-center gap-2 truncate tabular">
                <span className="size-[3px] shrink-0 rounded-full bg-metal/60" aria-hidden="true" />
                {s}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-4">
          <PriceBlock pricing={v.pricing} size="md" />
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-metal transition-colors duration-300 group-hover:border-white group-hover:bg-white group-hover:text-ink"
            aria-hidden="true"
          >
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>
      {/* Anel de foco visível para o cartão inteiro quando a ligação recebe foco */}
      <span className="pointer-events-none absolute inset-0 rounded-sm ring-white/80 group-has-[a:focus-visible]:ring-2" aria-hidden="true" />
    </article>
  );
}

export function VehicleGrid({ vehicles, priorityCount = 0 }: { vehicles: VehicleCardData[]; priorityCount?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {vehicles.map((v, i) => (
        <VehicleCard key={v.id} vehicle={v} priority={i < priorityCount} />
      ))}
    </div>
  );
}
