"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useTransition } from "react";
import { uploadSiteImage } from "@/app/admin/actions/content";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { assetUrl, type Asset } from "@/lib/site-schema";

/** Carregamento de uma imagem do site (fornecida pelo administrador). */
export function AssetUpload({
  kind,
  value,
  onChange,
  label,
  hint,
  aspect = "aspect-[16/9]",
}: {
  kind: "hero" | "logo" | "favicon" | "og";
  value: Asset;
  onChange: (a: Asset) => void;
  label: string;
  hint?: string;
  aspect?: string;
}) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const ext = kind === "favicon" ? "png" : "webp";

  return (
    <div>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-metal">{label}</p>
      <div className={cn("mt-1.5 flex items-center justify-center overflow-hidden rounded-sm border border-line bg-ink", kind === "logo" || kind === "favicon" ? "h-28" : aspect)}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrl(value, 1024, ext)} alt="" className={kind === "logo" || kind === "favicon" ? "max-h-16 w-auto" : "size-full object-cover"} />
        ) : (
          <span className="px-4 text-center text-xs text-metal">Sem imagem — é usado o fundo neutro / logótipo textual.</span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-metal/80">{hint}</p>}
      <div className="mt-2 flex gap-2">
        <Button type="button" size="sm" variant="secondary" loading={pending} icon={<ImagePlus className="size-3.5" />} onClick={() => ref.current?.click()}>
          {value ? "Substituir" : "Carregar imagem"}
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => onChange(null)}>
            Remover
          </Button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        aria-label={label}
        data-testid={`asset-${kind}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > 15 * 1024 * 1024) {
            toast("A imagem excede 15 MB.", "error");
            return;
          }
          const fd = new FormData();
          fd.append("kind", kind);
          fd.append("file", file);
          start(async () => {
            const r = await uploadSiteImage(fd);
            if (r.ok && r.data) {
              onChange(r.data);
              toast(r.message ?? "Imagem carregada.");
            } else if (!r.ok) toast(r.message, "error");
          });
        }}
      />
    </div>
  );
}
