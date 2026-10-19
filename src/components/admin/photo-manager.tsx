"use client";

import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, RefreshCw, Star, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deletePhoto, reorderPhotos, setPrimaryPhoto, updatePhotoMeta } from "@/app/admin/actions/vehicles";
import { photoSrc } from "@/components/site/vehicle-image";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge, Notice } from "@/components/ui/misc";
import { inputClass } from "@/components/ui/styles";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { replaceVehiclePhoto, uploadVehiclePhoto } from "@/components/admin/photo-upload";

export type ManagedPhoto = {
  id: string;
  storageKey: string;
  variants: number[];
  width: number;
  height: number;
  isPrimary: boolean;
  altText: string | null;
  caption: string | null;
  bytes: number;
};

type Upload = { id: string; name: string; preview: string; progress: number; error?: string; done?: boolean };

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 15 * 1024 * 1024;

export function PhotoManager({ vehicleId, photos, title }: { vehicleId: string; photos: ManagedPhoto[]; title: string }) {
  const router = useRouter();
  const toast = useToast();
  const [order, setOrder] = useState(photos);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [toDelete, setToDelete] = useState<ManagedPhoto | null>(null);
  const [, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);

  useEffect(() => setOrder(photos), [photos]);

  const uploadFiles = async (files: File[]) => {
    const queue: (Upload & { file: File })[] = [];
    for (const file of files) {
      const id = `${file.name}-${file.size}-${Math.random()}`;
      const preview = URL.createObjectURL(file);
      let error: string | undefined;
      if (!ACCEPT.includes(file.type)) error = "Formato não suportado (use JPEG, PNG, WebP ou AVIF).";
      else if (file.size > MAX_BYTES) error = "Ficheiro maior do que 15 MB.";
      queue.push({ id, name: file.name, preview, progress: 0, error, done: !!error, file });
    }
    setUploads((u) => [...u, ...queue.map(({ file: _f, ...rest }) => rest)]);
    let okCount = 0;
    for (const item of queue) {
      if (item.error) continue;
      const r = await uploadVehiclePhoto(vehicleId, item.file, (p) =>
        setUploads((u) => u.map((x) => (x.id === item.id ? { ...x, progress: p } : x))),
      );
      setUploads((u) => u.map((x) => (x.id === item.id ? { ...x, progress: 100, done: true, error: r.ok ? undefined : r.error } : x)));
      if (r.ok) okCount++;
    }
    if (okCount) {
      toast(`${okCount} fotografia(s) carregada(s).`);
      router.refresh();
      setTimeout(() => setUploads((u) => u.filter((x) => x.error)), 800);
    }
  };

  const persistOrder = (next: ManagedPhoto[]) => {
    setOrder(next);
    start(async () => {
      const r = await reorderPhotos(vehicleId, next.map((p) => p.id));
      if (r.ok) toast(r.message ?? "Ordem guardada.");
      else {
        toast(r.message, "error");
        setOrder(photos);
      }
    });
  };

  const move = (index: number, delta: number) => {
    const j = index + delta;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[index], next[j]] = [next[j], next[index]];
    persistOrder(next);
  };

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = [...order];
    const from = next.findIndex((p) => p.id === dragId);
    const to = next.findIndex((p) => p.id === targetId);
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setDragId(null);
    persistOrder(next);
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDropActive(true);
          }
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDropActive(false);
          uploadFiles(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed px-6 py-10 text-center transition-colors",
          dropActive ? "border-white bg-white/[0.05]" : "border-line-strong bg-white/[0.015]",
        )}
      >
        <UploadCloud className="size-8 text-metal" strokeWidth={1.3} aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-white">Arraste fotografias para aqui</p>
          <p className="mt-1 text-xs text-metal">JPEG, PNG, WebP ou AVIF · até 15 MB cada · são otimizadas e os metadados (incl. GPS) removidos</p>
        </div>
        <Button type="button" variant="secondary" size="sm" icon={<ImagePlus className="size-4" />} onClick={() => fileRef.current?.click()}>
          Escolher ficheiros
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT.join(",")}
          multiple
          className="sr-only"
          aria-label="Escolher fotografias para carregar"
          data-testid="photo-input"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) uploadFiles(files);
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-2" aria-live="polite" aria-label="Carregamentos">
          {uploads.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-sm border border-line px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.preview} alt="" className="size-10 rounded-[2px] object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-soft">{u.name}</p>
                {u.error ? (
                  <p className="text-xs text-danger">{u.error}</p>
                ) : (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-white transition-[width]" style={{ width: `${u.progress}%` }} />
                  </div>
                )}
              </div>
              {u.error && (
                <button type="button" className="text-xs text-metal hover:text-white" onClick={() => setUploads((x) => x.filter((y) => y.id !== u.id))}>
                  Dispensar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {order.length === 0 ? (
        <Notice>Ainda não existem fotografias. Enquanto não carregar fotografias, o showroom apresenta um marcador neutro.</Notice>
      ) : (
        <>
          <p className="text-xs text-metal">
            Arraste para reordenar (ou use as setas). A fotografia principal aparece nos cartões e partilhas. {order.length} fotografia(s).
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={`Fotografias de ${title}`}>
            {order.map((p, i) => (
              <li
                key={p.id}
                draggable
                onDragStart={(e) => {
                  setDragId(p.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (dragId) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  onDrop(p.id);
                }}
                onDragEnd={() => setDragId(null)}
                className={cn("overflow-hidden rounded-sm border bg-ink-2 transition-opacity", dragId === p.id ? "opacity-40" : "", p.isPrimary ? "border-white/50" : "border-line")}
              >
                <div className="relative aspect-[4/3] bg-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoSrc(p, 480)} alt={p.altText ?? ""} className="size-full object-cover" loading="lazy" />
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2">
                    <span className="flex items-center gap-1 rounded-sm bg-ink/75 px-1.5 py-1 text-xs text-soft backdrop-blur tabular">
                      <GripVertical className="size-3.5 cursor-grab text-metal" aria-hidden="true" /> {i + 1}
                    </span>
                    {p.isPrimary && <Badge tone="light">Principal</Badge>}
                  </div>
                </div>
                <PhotoMeta photo={p} />
                <div className="flex items-center justify-between gap-1 border-t border-line px-2 py-1.5">
                  <div className="flex gap-0.5">
                    <IconBtn label="Mover para trás" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowLeft />
                    </IconBtn>
                    <IconBtn label="Mover para a frente" onClick={() => move(i, 1)} disabled={i === order.length - 1}>
                      <ArrowRight />
                    </IconBtn>
                  </div>
                  <div className="flex gap-0.5">
                    <IconBtn
                      label="Definir como principal"
                      disabled={p.isPrimary}
                      onClick={() =>
                        start(async () => {
                          const r = await setPrimaryPhoto(vehicleId, p.id);
                          toast(r.ok ? (r.message ?? "Concluído.") : r.message, r.ok ? "success" : "error");
                        })
                      }
                    >
                      <Star className={p.isPrimary ? "fill-current" : ""} />
                    </IconBtn>
                    <IconBtn
                      label="Substituir fotografia"
                      onClick={() => {
                        replaceTarget.current = p.id;
                        replaceRef.current?.click();
                      }}
                    >
                      <RefreshCw />
                    </IconBtn>
                    <IconBtn label="Remover fotografia" danger onClick={() => setToDelete(p)}>
                      <Trash2 />
                    </IconBtn>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <input
        ref={replaceRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          const target = replaceTarget.current;
          if (!file || !target) return;
          if (!ACCEPT.includes(file.type) || file.size > MAX_BYTES) {
            toast("Ficheiro inválido (JPEG, PNG, WebP ou AVIF até 15 MB).", "error");
            return;
          }
          toast("A substituir fotografia…", "info");
          const r = await replaceVehiclePhoto(target, file);
          if (r.ok) {
            toast("Fotografia substituída.");
            router.refresh();
          } else toast(r.error ?? "Não foi possível substituir.", "error");
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Remover fotografia?"
        description="O ficheiro é eliminado definitivamente do armazenamento."
        confirmLabel="Remover"
        onConfirm={async () => {
          if (!toDelete) return;
          const r = await deletePhoto(toDelete.id);
          setToDelete(null);
          toast(r.ok ? (r.message ?? "Removida.") : r.message, r.ok ? "success" : "error");
        }}
      />
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-sm text-metal transition-colors hover:bg-white/[0.06] disabled:opacity-30 [&_svg]:size-4",
        danger ? "hover:text-danger" : "hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function PhotoMeta({ photo }: { photo: ManagedPhoto }) {
  const toast = useToast();
  const [alt, setAlt] = useState(photo.altText ?? "");
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [saving, start] = useTransition();
  const dirty = alt !== (photo.altText ?? "") || caption !== (photo.caption ?? "");
  return (
    <div className="space-y-2 p-3">
      <input
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        maxLength={200}
        placeholder="Texto alternativo (acessibilidade)"
        aria-label="Texto alternativo"
        className={cn(inputClass, "py-1.5 text-xs")}
      />
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={300}
        placeholder="Legenda (opcional)"
        aria-label="Legenda"
        className={cn(inputClass, "py-1.5 text-xs")}
      />
      {dirty && (
        <Button
          type="button"
          size="sm"
          variant="subtle"
          loading={saving}
          onClick={() =>
            start(async () => {
              const r = await updatePhotoMeta(photo.id, { altText: alt, caption });
              toast(r.ok ? (r.message ?? "Guardado.") : r.message, r.ok ? "success" : "error");
            })
          }
        >
          Guardar texto
        </Button>
      )}
    </div>
  );
}
