"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { commitImport, previewImport, type ImportPreview } from "@/app/admin/actions/import";
import { Button } from "@/components/ui/button";
import { Badge, Notice } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

const TEMPLATE_COLUMNS =
  "referencia;marca;modelo;versao;categoria;estado_viatura;ano;data_primeira_matricula;quilometros;combustivel;caixa;cilindrada;potencia_cv;cor_exterior;cor_interior;portas;lugares;preco_venda;preco_aquisicao;vin;estado;publicada;destaque;descricao_curta;descricao;equipamento;extras;garantia;notas_internas";

export function CsvImporter({ canSeeCosts }: { canSeeCosts: boolean }) {
  const toast = useToast();
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<"ignorar" | "atualizar">("ignorar");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const analyse = (text: string, m = mode) =>
    start(async () => {
      setError(null);
      setResult(null);
      const r = await previewImport(text, m);
      if (r.ok && r.data) setPreview(r.data);
      else if (!r.ok) {
        setPreview(null);
        setError(r.message);
      }
    });

  const template = `﻿${TEMPLATE_COLUMNS}\r\nCC-0001;Marca;Modelo;Versão;suv;usado;2021;;45000;gasoleo;manual;1499;130;Cinzento;Preto;5;5;21900;;;disponivel;não;não;;;Ar condicionado | Bluetooth;;;\r\n`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-line-strong px-6 py-10 text-center hover:border-white/50">
          <FileSpreadsheet className="size-8 text-metal" strokeWidth={1.3} />
          <span className="text-sm font-medium text-white">{fileName || "Escolher ficheiro CSV"}</span>
          <span className="text-xs text-metal">Separador “;” ou “,” · UTF-8 · máximo 1000 linhas</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            data-testid="csv-input"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 5_000_000) {
                setError("O ficheiro é demasiado grande (máximo 5 MB).");
                return;
              }
              const text = await file.text();
              setFileName(file.name);
              setCsv(text);
              analyse(text);
            }}
          />
        </label>
        <div className="space-y-4 rounded-sm border border-line p-5 text-sm">
          <fieldset>
            <legend className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-metal">Referências já existentes</legend>
            <div className="mt-3 space-y-2">
              {(["ignorar", "atualizar"] as const).map((m) => (
                <label key={m} className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => {
                      setMode(m);
                      if (csv) analyse(csv, m);
                    }}
                    className="mt-1 accent-white"
                  />
                  <span className="text-soft">{m === "ignorar" ? "Ignorar (não alterar viaturas existentes)" : "Atualizar com os valores do ficheiro"}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`}
            download="modelo-importacao-crewcar.csv"
            className="inline-block text-xs font-semibold uppercase tracking-[0.14em] text-white underline underline-offset-4"
          >
            Descarregar modelo CSV
          </a>
          {!canSeeCosts && <p className="text-xs text-metal">A coluna “preco_aquisicao” é ignorada para o seu perfil.</p>}
        </div>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}
      {pending && <p className="text-sm text-metal">A analisar…</p>}

      {(result ?? preview) && (
        <Report
          data={(result ?? preview)!}
          done={!!result}
          action={
            !result && (
              <Button
                icon={<Upload className="size-4" />}
                loading={pending}
                disabled={!preview || preview.created + preview.updated === 0}
                onClick={() =>
                  start(async () => {
                    const r = await commitImport(csv!, mode);
                    if (r.ok && r.data) {
                      setResult(r.data);
                      toast(r.message ?? "Importação concluída.");
                    } else if (!r.ok) toast(r.message, "error");
                  })
                }
              >
                Importar {preview ? preview.created + preview.updated : 0} viatura(s)
              </Button>
            )
          }
        />
      )}
      {result && (
        <Link href="/admin/viaturas" className="inline-block text-sm text-white underline underline-offset-4">
          Ver viaturas
        </Link>
      )}
    </div>
  );
}

function Report({ data, done, action }: { data: ImportPreview; done: boolean; action: React.ReactNode }) {
  const tone = { novo: "ok", atualizar: "light", duplicado: "neutral", erro: "danger" } as const;
  const label = { novo: done ? "Criada" : "Nova", atualizar: done ? "Atualizada" : "Atualizar", duplicado: "Duplicada", erro: "Erro" };
  return (
    <section className="rounded-sm border border-line" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
        <p className="text-sm text-soft">
          <strong className="text-white">{data.total}</strong> linha(s) · {data.created} {done ? "criada(s)" : "nova(s)"} · {data.updated}{" "}
          {done ? "atualizada(s)" : "a atualizar"} · {data.skipped} duplicada(s) · <span className={data.failed ? "text-danger" : ""}>{data.failed} com erro</span>
        </p>
        {action}
      </div>
      <div className="max-h-[28rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-ink-2">
            <tr className="text-left text-[0.66rem] uppercase tracking-[0.14em] text-metal">
              <th className="px-5 py-2.5">Linha</th>
              <th className="px-5 py-2.5">Referência</th>
              <th className="px-5 py-2.5">Viatura</th>
              <th className="px-5 py-2.5">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.line} className={cn("border-t border-line align-top", r.outcome === "erro" && "bg-danger/[0.03]")}>
                <td className="px-5 py-2.5 text-metal tabular">{r.line}</td>
                <td className="px-5 py-2.5 text-white">{r.reference || "—"}</td>
                <td className="px-5 py-2.5 text-soft">{r.title || "—"}</td>
                <td className="px-5 py-2.5">
                  <Badge tone={tone[r.outcome]}>{label[r.outcome]}</Badge>
                  {r.errors.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-xs text-metal">
                      {r.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
