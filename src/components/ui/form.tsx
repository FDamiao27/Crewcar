"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { inputClass } from "./styles";


export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-metal">
        {label}
        {required && (
          <span className="ml-1 text-soft" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert" id={htmlFor ? `${htmlFor}-error` : undefined}>
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-metal/80" id={htmlFor ? `${htmlFor}-hint` : undefined}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = ComponentProps<"input"> & { label?: ReactNode; hint?: ReactNode; error?: string | null; wrapperClassName?: string };

export function Input({ label, hint, error, wrapperClassName, className, id, required, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const input = (
    <input
      id={inputId}
      required={required}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
      className={cn(inputClass, className)}
      {...rest}
    />
  );
  if (!label) return input;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={wrapperClassName}>
      {input}
    </Field>
  );
}

type TextareaProps = ComponentProps<"textarea"> & { label?: ReactNode; hint?: ReactNode; error?: string | null; wrapperClassName?: string };

export function Textarea({ label, hint, error, wrapperClassName, className, id, required, ...rest }: TextareaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const el = (
    <textarea
      id={inputId}
      required={required}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
      className={cn(inputClass, "min-h-28 resize-y leading-relaxed", className)}
      {...rest}
    />
  );
  if (!label) return el;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={wrapperClassName}>
      {el}
    </Field>
  );
}

type SelectProps = ComponentProps<"select"> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  wrapperClassName?: string;
  options: { value: string; label: string }[] | Record<string, string>;
  placeholder?: string;
};

export function Select({ label, hint, error, wrapperClassName, className, id, options, placeholder, required, ...rest }: SelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const list = Array.isArray(options) ? options : Object.entries(options).map(([value, label]) => ({ value, label }));
  const el = (
    <select
      id={inputId}
      required={required}
      aria-invalid={error ? true : undefined}
      className={cn(
        inputClass,
    "cc-select",
        className,
      )}
      {...rest}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {list.map((o) => (
        <option key={o.value} value={o.value} className="bg-ink-2">
          {o.label}
        </option>
      ))}
    </select>
  );
  if (!label) return el;
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={wrapperClassName}>
      {el}
    </Field>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...rest
}: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={rest.id ?? id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer appearance-none rounded-[3px] border border-line-strong bg-ink transition-colors checked:border-white cc-check disabled:opacity-50"
        {...rest}
      />
      <label htmlFor={rest.id ?? id} className="cursor-pointer text-sm leading-snug text-soft">
        {label}
        {description && <span className="mt-0.5 block text-xs text-metal">{description}</span>}
      </label>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  const autoId = useId();
  const switchId = id ?? autoId;
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={switchId} className="cursor-pointer">
        <span className="block text-sm font-medium text-white">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-metal">{description}</span>}
      </label>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-50",
          checked ? "border-white bg-white" : "border-line-strong bg-graphite",
        )}
      >
        <span
          className={cn(
            "inline-block size-3.5 rounded-full transition-transform duration-200",
            checked ? "translate-x-[18px] bg-ink" : "translate-x-[2px] bg-metal",
          )}
        />
      </button>
    </div>
  );
}
