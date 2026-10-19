import { cn } from "@/lib/cn";
import { formatDate, formatPercent, formatPrice } from "@/lib/format";
import type { Pricing } from "@/lib/pricing";

/** Apresentação de preço: atual, anterior (preço de referência legal) e poupança. */
export function PriceBlock({
  pricing,
  size = "md",
  className,
  showEnd = false,
  timeZone,
}: {
  pricing: Pricing;
  size?: "sm" | "md" | "lg";
  className?: string;
  showEnd?: boolean;
  timeZone?: string;
}) {
  if (pricing.finalPriceCents === null || pricing.finalPriceCents <= 0) {
    return <p className={cn("text-sm font-medium text-metal", className)}>Preço sob consulta</p>;
  }
  return (
    <div className={cn("flex flex-col", className)}>
      {pricing.hasDiscount && pricing.referencePriceCents !== null && (
        <div className="flex flex-wrap items-baseline gap-x-2 text-metal">
          <span className={cn("tabular line-through decoration-metal/70", size === "lg" ? "text-base" : "text-xs")}>
            <span className="sr-only">Preço anterior: </span>
            {formatPrice(pricing.referencePriceCents)}
          </span>
          <span
            className={cn(
              "rounded-sm bg-white/[0.08] px-1.5 py-px font-semibold text-soft tabular",
              size === "lg" ? "text-xs" : "text-[0.62rem]",
            )}
          >
            −{formatPercent(pricing.savingsPercent)}
          </span>
        </div>
      )}
      <p
        className={cn(
          "price text-white",
          size === "lg" ? "text-4xl md:text-[2.75rem]" : size === "md" ? "text-xl" : "text-base",
        )}
      >
        <span className="sr-only">Preço: </span>
        {formatPrice(pricing.finalPriceCents)}
      </p>
      {pricing.hasDiscount && size !== "sm" && (
        <p className={cn("mt-1 text-metal", size === "lg" ? "text-sm" : "text-xs")}>
          Poupa {formatPrice(pricing.savingsCents)}
          {showEnd && pricing.promotionEndsAt && <> · até {formatDate(pricing.promotionEndsAt, timeZone)}</>}
        </p>
      )}
    </div>
  );
}
