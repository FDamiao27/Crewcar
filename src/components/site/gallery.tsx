"use client";

import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { PhotoPlaceholder, photoSrc, photoSrcSet, type ImageLike } from "./vehicle-image";

type Photo = ImageLike & { id: string; caption: string | null };

export function Gallery({ photos, title }: { photos: Photo[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const count = photos.length;

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (full && !el.open) el.showModal();
    if (!full && el.open) el.close();
  }, [full]);

  useEffect(() => {
    thumbsRef.current
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [index]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  };
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => (touch.current = e.touches[0].clientX),
    onTouchEnd: (e: React.TouchEvent) => {
      if (touch.current === null) return;
      const dx = e.changedTouches[0].clientX - touch.current;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      touch.current = null;
    },
  };

  if (!count) {
    return (
      <div className="aspect-[16/10] overflow-hidden rounded-sm border border-line">
        <PhotoPlaceholder label="Fotografias brevemente disponíveis" />
      </div>
    );
  }

  const current = photos[index];
  const alt = (p: Photo, i: number) => p.altText || `${title} — fotografia ${i + 1} de ${count}`;

  return (
    <div className="flex flex-col gap-3" aria-roledescription="galeria" aria-label={`Fotografias de ${title}`}>
      <div
        className="group relative aspect-[16/10] overflow-hidden rounded-sm border border-line bg-ink-2"
        onKeyDown={onKey}
        {...swipe}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.id}
          src={photoSrc(current, 1600)}
          srcSet={photoSrcSet(current)}
          sizes="(min-width: 1024px) 62vw, 100vw"
          alt={alt(current, index)}
          width={current.width}
          height={current.height}
          fetchPriority={index === 0 ? "high" : undefined}
          className="size-full animate-fade-in object-cover"
        />
        <button
          type="button"
          onClick={() => setFull(true)}
          className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full border border-white/15 bg-ink/60 text-white opacity-90 backdrop-blur transition-opacity hover:bg-ink/80"
          aria-label="Ver em ecrã inteiro"
        >
          <Expand className="size-4" />
        </button>
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute top-1/2 left-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-ink/60 text-white backdrop-blur transition hover:bg-ink/85 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              aria-label="Fotografia anterior"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute top-1/2 right-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-ink/60 text-white backdrop-blur transition hover:bg-ink/85 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              aria-label="Fotografia seguinte"
            >
              <ChevronRight className="size-5" />
            </button>
            <p className="absolute bottom-3 left-3 rounded-sm bg-ink/70 px-2 py-1 text-[0.7rem] text-soft tabular backdrop-blur" aria-live="polite">
              {index + 1} / {count}
            </p>
          </>
        )}
      </div>
      {current.caption && <p className="text-sm text-metal">{current.caption}</p>}

      {count > 1 && (
        <div ref={thumbsRef} className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Miniaturas">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              data-index={i}
              aria-selected={i === index}
              aria-label={`Ver fotografia ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-sm border transition-[opacity,border-color] md:w-28",
                i === index ? "border-white opacity-100" : "border-line opacity-55 hover:opacity-90",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoSrc(p, 400)} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setFull(false)}
        onKeyDown={onKey}
        aria-label={`Fotografias de ${title} em ecrã inteiro`}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/95 p-0 text-white backdrop:bg-black"
      >
        {full && (
          <div className="relative flex size-full flex-col" {...swipe}>
            <div className="flex items-center justify-between px-4 py-3 text-sm text-soft">
              <span className="tabular">
                {index + 1} / {count}
              </span>
              <button
                type="button"
                onClick={() => setFull(false)}
                className="flex size-10 items-center justify-center rounded-full border border-white/15 hover:bg-white/10"
                aria-label="Fechar ecrã inteiro"
                autoFocus
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 md:px-16">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={current.id}
                src={photoSrc(current, 1920)}
                alt={alt(current, index)}
                className="max-h-full max-w-full animate-fade-in object-contain"
              />
              {count > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    className="absolute left-2 flex size-12 items-center justify-center rounded-full border border-white/15 bg-black/40 hover:bg-white/10 md:left-4"
                    aria-label="Fotografia anterior"
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    className="absolute right-2 flex size-12 items-center justify-center rounded-full border border-white/15 bg-black/40 hover:bg-white/10 md:right-4"
                    aria-label="Fotografia seguinte"
                  >
                    <ChevronRight className="size-6" />
                  </button>
                </>
              )}
            </div>
            <p className="min-h-12 px-4 py-3 text-center text-sm text-metal">{current.caption}</p>
          </div>
        )}
      </dialog>
    </div>
  );
}
