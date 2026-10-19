"use client";

import { Save } from "lucide-react";
import { useState, useTransition } from "react";
import { savePage } from "@/app/admin/actions/content";
import { Button } from "@/components/ui/button";
import { Input, Switch, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { Markdown } from "@/lib/markdown";
import { useUnsavedChanges } from "./use-unsaved";

type PageInput = { title: string; body: string; seoTitle: string; seoDescription: string; isPublished: boolean };

export function PageEditor({ slug, initial }: { slug: string; initial: PageInput }) {
  const toast = useToast();
  const [p, setP] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(p) !== saved;
  useUnsavedChanges(dirty);
  const placeholders = p.body.match(/\[[^\]\n]+\](?!\()/g) ?? [];

  return (
    <div className="space-y-6">
      <Notice tone="warn" title="Modelo a rever">
        Estes textos são modelos de partida. Substitua todos os campos entre [parênteses retos] pelos dados reais da empresa e confirme o conteúdo com um
        profissional antes de publicar. O website não afirma qualquer conformidade jurídica.
      </Notice>
      <div className="grid gap-8 xl:grid-cols-2">
        <div className="space-y-5">
          <Input label="Título" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} maxLength={150} error={errors.title} />
          <Textarea
            label="Conteúdo"
            value={p.body}
            onChange={(e) => setP({ ...p, body: e.target.value })}
            rows={24}
            error={errors.body}
            hint="Formatação: ## Título, **negrito**, *itálico*, - listas, [texto](https://ligação). Linhas em branco separam parágrafos."
            className="font-mono text-[0.82rem]"
          />
          <Input label="Título para SEO" value={p.seoTitle} onChange={(e) => setP({ ...p, seoTitle: e.target.value })} maxLength={120} error={errors.seoTitle} />
          <Textarea label="Descrição para SEO" value={p.seoDescription} onChange={(e) => setP({ ...p, seoDescription: e.target.value })} maxLength={300} rows={2} error={errors.seoDescription} />
          <div className="rounded-sm border border-line p-4">
            <Switch checked={p.isPublished} onChange={(v) => setP({ ...p, isPublished: v })} label="Publicada" description="Quando publicada, a página aparece no rodapé e no website." />
            {p.isPublished && placeholders.length > 0 && (
              <p className="mt-3 text-xs text-warn">Atenção: ainda existem {placeholders.length} campo(s) por preencher, por exemplo {placeholders[0]}.</p>
            )}
          </div>
          <Button
            icon={<Save className="size-4" />}
            loading={pending}
            disabled={!dirty}
            onClick={() =>
              start(async () => {
                const r = await savePage(slug, p);
                if (r.ok) {
                  setErrors({});
                  setSaved(JSON.stringify(p));
                  toast(r.message ?? "Guardado.");
                } else {
                  setErrors(r.fieldErrors ?? {});
                  toast(r.message, "error");
                }
              })
            }
          >
            Guardar
          </Button>
        </div>
        <div>
          <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-metal">Pré-visualização</p>
          <div className="max-h-[80vh] overflow-y-auto rounded-sm border border-line bg-ink p-6 md:p-8">
            <h1 className="display-title mb-8 text-3xl text-white">{p.title}</h1>
            <Markdown source={p.body} />
          </div>
        </div>
      </div>
    </div>
  );
}
