import { cn } from "@/lib/cn";
import { assetUrl, type Asset } from "@/lib/site-schema";

/** Logótipo textual em CSS, substituível por um ficheiro carregado no back office. */
export function Logo({
  brandName,
  logo,
  className,
  size = "md",
}: {
  brandName: string;
  logo?: Asset;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={assetUrl(logo)}
        alt={brandName}
        width={logo.width}
        height={logo.height}
        className={cn(size === "lg" ? "h-10" : size === "sm" ? "h-6" : "h-8", "w-auto", className)}
      />
    );
  }
  const words = brandName.trim().toUpperCase().split(/\s+/);
  const first = words[0] ?? "";
  const rest = words.slice(1).join(" ");
  return (
    <span
      className={cn(
        "inline-flex items-center font-display leading-none text-white select-none",
        size === "lg" ? "text-xl" : size === "sm" ? "text-[0.8rem]" : "text-[0.95rem]",
        className,
      )}
    >
      <span className="font-extrabold tracking-[var(--tracking-brand)]">{first}</span>
      {rest && (
        <>
          {" "}
          <span className="mx-[0.7em] h-[0.95em] w-px bg-metal/70" aria-hidden="true" />
          <span className="font-light tracking-[var(--tracking-brand)] text-soft">{rest}</span>
        </>
      )}
    </span>
  );
}
