"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

/** Diálogo modal acessível baseado no elemento <dialog> nativo (foco, Esc e inert). */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-sm border border-line-strong bg-ink-2 p-0 text-soft shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop:bg-black/70 backdrop:backdrop-blur-sm open:animate-fade-up",
        size === "sm" && "max-w-md",
        size === "md" && "max-w-xl",
        size === "lg" && "max-w-3xl",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div>
              <h2 id="dialog-title" className="text-base font-semibold text-white">
                {title}
              </h2>
              {description && <div className="mt-1 text-sm text-metal">{description}</div>}
            </div>
            <button type="button" onClick={onClose} className="-m-1 rounded-sm p-1 text-metal hover:text-white" aria-label="Fechar">
              <X className="size-4" />
            </button>
          </div>
          {children && <div className="overflow-y-auto px-6 py-5">{children}</div>}
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Confirmação para ações destrutivas. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  tone = "danger",
  requireText,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  requireText?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const blocked = requireText ? typed.trim().toUpperCase() !== requireText.toUpperCase() : false;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) {
          setTyped("");
          onClose();
        }
      }}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            loading={busy}
            disabled={blocked}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
                setTyped("");
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-soft/85">
        <div>{description}</div>
        {requireText && (
          <label className="block">
            <span className="mb-1.5 block text-xs text-metal">
              Para confirmar, escreva <strong className="text-white">{requireText}</strong>
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="block w-full rounded-sm border border-line bg-ink px-3 py-2 text-white focus:border-white/70 focus:outline-none"
              autoComplete="off"
            />
          </label>
        )}
      </div>
    </Dialog>
  );
}
