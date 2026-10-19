import { CarFront } from "lucide-react";
import { cn } from "@/lib/cn";

export type ImageLike = { storageKey: string; variants: number[]; width: number; height: number; altText?: string | null };

export function photoSrc(photo: ImageLike, minWidth = 1024): string {
  const sorted = [...photo.variants].sort((a, b) => a - b);
  const w = sorted.find((v) => v >= minWidth) ?? sorted[sorted.length - 1];
  return `/media/${photo.storageKey}-${w}.webp`;
}

export function photoSrcSet(photo: ImageLike): string {
  return [...photo.variants]
    .sort((a, b) => a - b)
    .map((w) => `/media/${photo.storageKey}-${w}.webp ${w}w`)
    .join(", ");
}

/** Fotografia carregada pelo administrador, com versões responsivas e carregamento diferido. */
export function VehicleImage({
  photo,
  alt,
  sizes = "(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw",
  priority,
  className,
}: {
  photo: ImageLike;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoSrc(photo)}
      srcSet={photoSrcSet(photo)}
      sizes={sizes}
      alt={photo.altText || alt}
      width={photo.width}
      height={photo.height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      className={cn("size-full object-cover", className)}
    />
  );
}

/** Marcador neutro em CSS quando ainda não existem fotografias. */
export function PhotoPlaceholder({ label = "Fotografias em breve", className, compact }: { label?: string; className?: string; compact?: boolean }) {
  return (
    <div
      className={cn("placeholder-plate relative flex size-full flex-col items-center justify-center gap-3 overflow-hidden", className)}
      role="img"
      aria-label={label}
    >
      <div className="pointer-events-none absolute inset-x-[12%] bottom-[22%] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <CarFront className={cn("text-white/20", compact ? "size-7" : "size-10")} strokeWidth={1} aria-hidden="true" />
      {!compact && <span className="eyebrow !text-[0.6rem] text-metal/70">{label}</span>}
    </div>
  );
}
