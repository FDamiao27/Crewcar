"use client";

import { ArrowDown, ArrowUp, Eye, Plus, Save, Send, Trash2, Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { discardContentDraft, publishContent, saveContentDraft } from "@/app/admin/actions/content";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Checkbox, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Badge, Notice } from "@/components/ui/misc";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { ADVANTAGE_ICONS, type Content } from "@/lib/site-schema";
import { AssetUpload } from "./asset-upload";
import { useUnsavedChanges } from "./use-unsaved";

type TabId = "inicio" | "stand" | "vantagens" | "faq" | "banners" | "rodape";

function move<T>(list: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function ContentEditor({
  draft,
  hasUnpublished,
  publishedAt,
}: {
  draft: Content;
  hasUnpublished: boolean;
  publishedAt: Date | null;
}) {
  const toast = useToast();
  const [c, setC] = useState<Content>(draft);
  const [saved, setSaved] = useState(JSON.stringify(draft));
  const [unpublished, setUnpublished] = useState(hasUnpublished);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<TabId>("inicio");
  const [pending, start] = useTransition();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = JSON.stringify(c) !== saved;
  useUnsavedChanges(dirty);

  const set = <K extends keyof Content>(key: K, value: Content[K]) => setC((prev) => ({ ...prev, [key]: value }));
  const err = (k: string) => errors[k] || undefined;

  const handle = (r: { ok: boolean; message?: string; fieldErrors?: Record<string, string> }, onOk: () => void) => {
    if (r.ok) {
      setErrors({});
      onOk();
      toast(r.message ?? "Guardado.");
    } else {
      setErrors(r.fieldErrors ?? {});
      toast(r.message ?? "Erro.", "error");
    }
  };

  const saveDraft = (then?: () => void) =>
    start(async () => {
      const r = await saveContentDraft(c);
      handle(r, () => {
        setSaved(JSON.stringify(c));
        setUnpublished(true);
        then?.();
      });
    });

  const preview = () => {
    // Abrir já a janela (evita bloqueio de pop-ups) e navegar depois de guardar o rascunho
    const win = window.open("about:blank", "_blank");
    saveDraft(() => {
      if (win) win.location.href = "/api/admin/preview?destino=/";
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 rounded-sm border border-line bg-white/[0.02] p-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-soft">
          {dirty ? (
            <Badge tone="warn">Alterações por guardar</Badge>
          ) : unpublished ? (
            <Badge tone="outline">Rascunho por publicar</Badge>
          ) : (
            <Badge tone="ok">Publicado</Badge>
          )}
          <span className="ml-3 text-xs text-metal">Última publicação: {formatDateTime(publishedAt)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {unpublished && !dirty && (
            <Button variant="ghost" size="sm" icon={<Undo2 className="size-3.5" />} onClick={() => setConfirmDiscard(true)}>
              Descartar rascunho
            </Button>
          )}
          <Button variant="secondary" size="sm" icon={<Save className="size-3.5" />} loading={pending} disabled={!dirty} onClick={() => saveDraft()}>
            Guardar rascunho
          </Button>
          <Button variant="secondary" size="sm" icon={<Eye className="size-3.5" />} onClick={preview}>
            Pré-visualizar
          </Button>
          <Button
            size="sm"
            icon={<Send className="size-3.5" />}
            loading={pending}
            disabled={!dirty && !unpublished}
            onClick={() =>
              start(async () => {
                const r = await publishContent(c);
                handle(r, () => {
                  setSaved(JSON.stringify(c));
                  setUnpublished(false);
                });
              })
            }
          >
            Publicar
          </Button>
        </div>
      </div>

      {Object.values(errors).some(Boolean) && (
        <Notice tone="danger" className="mb-6">
          Existem campos por corrigir: {Object.entries(errors).filter(([, v]) => v).map(([k]) => k).join(", ")}
        </Notice>
      )}

      <Tabs<TabId>
        label="Secções de conteúdo"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "inicio", label: "Página inicial" },
          { id: "stand", label: "O Stand" },
          { id: "vantagens", label: `Vantagens (${c.advantages.items.length})` },
          { id: "faq", label: `Perguntas frequentes (${c.faq.items.length})` },
          { id: "banners", label: `Banners (${c.banners.length})` },
          { id: "rodape", label: "Rodapé e SEO" },
        ]}
      />

      <TabPanel id="inicio" active={tab === "inicio"}>
        <div className="grid gap-8 xl:grid-cols-2">
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-white">Secção principal</h2>
            <Input label="Etiqueta superior" value={c.hero.eyebrow} onChange={(e) => set("hero", { ...c.hero, eyebrow: e.target.value })} maxLength={60} error={err("hero.eyebrow")} />
            <Input label="Título principal" required value={c.hero.title} onChange={(e) => set("hero", { ...c.hero, title: e.target.value })} maxLength={120} error={err("hero.title")} />
            <Textarea label="Subtítulo" value={c.hero.subtitle} onChange={(e) => set("hero", { ...c.hero, subtitle: e.target.value })} maxLength={300} rows={3} error={err("hero.subtitle")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Botão principal" value={c.hero.primaryCta} onChange={(e) => set("hero", { ...c.hero, primaryCta: e.target.value })} maxLength={40} error={err("hero.primaryCta")} />
              <Input label="Botão secundário" value={c.hero.secondaryCta} onChange={(e) => set("hero", { ...c.hero, secondaryCta: e.target.value })} maxLength={40} error={err("hero.secondaryCta")} />
            </div>
          </div>
          <div className="space-y-5">
            <AssetUpload
              kind="hero"
              label="Imagem principal"
              value={c.hero.image}
              onChange={(image) => set("hero", { ...c.hero, image })}
              hint="Fotografia própria em formato horizontal (mín. 1920 px de largura recomendado). Sem imagem, é apresentado um fundo neutro."
            />
            {c.hero.image && (
              <Input
                label={`Escurecimento da imagem (${c.hero.overlay}%)`}
                type="range"
                min={0}
                max={90}
                step={5}
                value={c.hero.overlay}
                onChange={(e) => set("hero", { ...c.hero, overlay: Number(e.target.value) })}
                className="px-0 accent-white"
              />
            )}
          </div>
        </div>

        <div className="mt-10 grid gap-8 border-t border-line pt-8 xl:grid-cols-2">
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-white">Secções de viaturas</h2>
            <Input label="Título — destaques" value={c.home.featuredTitle} onChange={(e) => set("home", { ...c.home, featuredTitle: e.target.value })} maxLength={80} />
            <Input label="Texto — destaques" value={c.home.featuredSubtitle} onChange={(e) => set("home", { ...c.home, featuredSubtitle: e.target.value })} maxLength={200} />
            <Input label="Título — chegadas recentes" value={c.home.latestTitle} onChange={(e) => set("home", { ...c.home, latestTitle: e.target.value })} maxLength={80} />
            <Input label="Texto — chegadas recentes" value={c.home.latestSubtitle} onChange={(e) => set("home", { ...c.home, latestSubtitle: e.target.value })} maxLength={200} />
            <p className="text-xs text-metal">As viaturas em destaque escolhem-se em cada viatura (separador Publicação) ou na lista de viaturas.</p>
          </div>
          <div className="space-y-4 rounded-sm border border-line p-5">
            <h2 className="text-sm font-semibold text-white">Secções visíveis na página inicial</h2>
            <Switch checked={c.home.showLatest} onChange={(v) => set("home", { ...c.home, showLatest: v })} label="Chegadas recentes" />
            <Switch checked={c.home.showAbout} onChange={(v) => set("home", { ...c.home, showAbout: v })} label="Apresentação da marca" />
            <Switch checked={c.home.showAdvantages} onChange={(v) => set("home", { ...c.home, showAdvantages: v })} label="Vantagens" description="Só aparece se existirem vantagens configuradas." />
            <Switch checked={c.home.showFaq} onChange={(v) => set("home", { ...c.home, showFaq: v })} label="Perguntas frequentes" description="Só aparece se existirem perguntas configuradas." />
            <Switch checked={c.home.showContacts} onChange={(v) => set("home", { ...c.home, showContacts: v })} label="Contactos" />
          </div>
        </div>
      </TabPanel>

      <TabPanel id="stand" active={tab === "stand"}>
        <div className="max-w-3xl space-y-5">
          <Input label="Título" value={c.about.title} onChange={(e) => set("about", { ...c.about, title: e.target.value })} maxLength={80} error={err("about.title")} />
          <Textarea label="Introdução" value={c.about.lead} onChange={(e) => set("about", { ...c.about, lead: e.target.value })} maxLength={400} rows={3} error={err("about.lead")} />
          <Textarea
            label="Apresentação completa"
            value={c.about.body}
            onChange={(e) => set("about", { ...c.about, body: e.target.value })}
            maxLength={10000}
            rows={12}
            hint="Formatação simples: ## Título, **negrito**, - listas, [texto](https://ligação)."
            error={err("about.body")}
          />
          <Notice>Descreva apenas factos verificáveis sobre o stand (história, localização, serviços efetivamente prestados).</Notice>
        </div>
      </TabPanel>

      <TabPanel id="vantagens" active={tab === "vantagens"}>
        <div className="max-w-3xl space-y-5">
          <Input label="Título da secção" value={c.advantages.title} onChange={(e) => set("advantages", { ...c.advantages, title: e.target.value })} maxLength={80} />
          <Notice tone="warn">Apresente apenas vantagens verdadeiras e que o stand garante (por exemplo, garantia, revisão antes da entrega, financiamento com parceiro identificado).</Notice>
          {c.advantages.items.map((a, i) => (
            <div key={i} className="space-y-3 rounded-sm border border-line p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                <Input
                  label={`Vantagem ${i + 1}`}
                  value={a.title}
                  onChange={(e) => set("advantages", { ...c.advantages, items: c.advantages.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })}
                  maxLength={80}
                  error={err(`advantages.items.${i}.title`)}
                />
                <Select
                  label="Ícone"
                  value={a.icon}
                  onChange={(e) =>
                    set("advantages", { ...c.advantages, items: c.advantages.items.map((x, j) => (j === i ? { ...x, icon: e.target.value as typeof a.icon } : x)) })
                  }
                  options={ADVANTAGE_ICONS}
                />
              </div>
              <Textarea
                label="Descrição"
                value={a.text}
                onChange={(e) => set("advantages", { ...c.advantages, items: c.advantages.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                maxLength={300}
                rows={2}
              />
              <ItemTools
                onUp={() => set("advantages", { ...c.advantages, items: move(c.advantages.items, i, -1) })}
                onDown={() => set("advantages", { ...c.advantages, items: move(c.advantages.items, i, 1) })}
                onRemove={() => set("advantages", { ...c.advantages, items: c.advantages.items.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="subtle"
            icon={<Plus className="size-4" />}
            disabled={c.advantages.items.length >= 12}
            onClick={() => set("advantages", { ...c.advantages, items: [...c.advantages.items, { title: "", text: "", icon: "check" }] })}
          >
            Adicionar vantagem
          </Button>
        </div>
      </TabPanel>

      <TabPanel id="faq" active={tab === "faq"}>
        <div className="max-w-3xl space-y-5">
          <Input label="Título da secção" value={c.faq.title} onChange={(e) => set("faq", { ...c.faq, title: e.target.value })} maxLength={80} />
          {c.faq.items.map((f, i) => (
            <div key={i} className="space-y-3 rounded-sm border border-line p-4">
              <Input
                label={`Pergunta ${i + 1}`}
                value={f.question}
                onChange={(e) => set("faq", { ...c.faq, items: c.faq.items.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)) })}
                maxLength={200}
                error={err(`faq.items.${i}.question`)}
              />
              <Textarea
                label="Resposta"
                value={f.answer}
                onChange={(e) => set("faq", { ...c.faq, items: c.faq.items.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)) })}
                maxLength={2000}
                rows={3}
                error={err(`faq.items.${i}.answer`)}
              />
              <ItemTools
                onUp={() => set("faq", { ...c.faq, items: move(c.faq.items, i, -1) })}
                onDown={() => set("faq", { ...c.faq, items: move(c.faq.items, i, 1) })}
                onRemove={() => set("faq", { ...c.faq, items: c.faq.items.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="subtle"
            icon={<Plus className="size-4" />}
            disabled={c.faq.items.length >= 40}
            onClick={() => set("faq", { ...c.faq, items: [...c.faq.items, { question: "", answer: "" }] })}
          >
            Adicionar pergunta
          </Button>
        </div>
      </TabPanel>

      <TabPanel id="banners" active={tab === "banners"}>
        <div className="max-w-3xl space-y-5">
          <p className="text-sm text-metal">Mensagem curta no topo de todas as páginas (é mostrado o primeiro banner ativo dentro das datas indicadas).</p>
          {c.banners.map((b, i) => {
            const upd = (patch: Partial<typeof b>) => set("banners", c.banners.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={b.id} className="space-y-3 rounded-sm border border-line p-4">
                <Input label={`Banner ${i + 1}`} value={b.text} onChange={(e) => upd({ text: e.target.value })} maxLength={200} error={err(`banners.${i}.text`)} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Texto da ligação" value={b.linkLabel} onChange={(e) => upd({ linkLabel: e.target.value })} maxLength={40} placeholder="Ex.: Ver viaturas" />
                  <Input label="Ligação" value={b.linkUrl} onChange={(e) => upd({ linkUrl: e.target.value })} placeholder="/viaturas" error={err(`banners.${i}.linkUrl`)} />
                  <Input label="Início (opcional)" type="date" value={b.startsAt} onChange={(e) => upd({ startsAt: e.target.value })} />
                  <Input label="Fim (opcional)" type="date" value={b.endsAt} onChange={(e) => upd({ endsAt: e.target.value })} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Checkbox label="Ativo" checked={b.active} onChange={(e) => upd({ active: e.target.checked })} />
                  <ItemTools
                    onUp={() => set("banners", move(c.banners, i, -1))}
                    onDown={() => set("banners", move(c.banners, i, 1))}
                    onRemove={() => set("banners", c.banners.filter((_, j) => j !== i))}
                  />
                </div>
              </div>
            );
          })}
          <Button
            type="button"
            variant="subtle"
            icon={<Plus className="size-4" />}
            disabled={c.banners.length >= 10}
            onClick={() =>
              set("banners", [...c.banners, { id: Math.random().toString(36).slice(2, 10), text: "", linkLabel: "", linkUrl: "", active: true, startsAt: "", endsAt: "" }])
            }
          >
            Adicionar banner
          </Button>
        </div>
      </TabPanel>

      <TabPanel id="rodape" active={tab === "rodape"}>
        <div className="grid max-w-5xl gap-8 xl:grid-cols-2">
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-white">Rodapé</h2>
            <Textarea label="Texto do rodapé" value={c.footer.text} onChange={(e) => set("footer", { ...c.footer, text: e.target.value })} maxLength={300} rows={3} hint="Os dados legais (denominação, NIF, sede) configuram-se em Definições." />
            <h2 className="pt-4 text-sm font-semibold text-white">SEO da página inicial</h2>
            <Input label="Título" value={c.seo.title} onChange={(e) => set("seo", { ...c.seo, title: e.target.value })} maxLength={70} hint={`${c.seo.title.length}/60 recomendados`} error={err("seo.title")} />
            <Textarea label="Descrição" value={c.seo.description} onChange={(e) => set("seo", { ...c.seo, description: e.target.value })} maxLength={170} rows={3} hint={`${c.seo.description.length}/160 recomendados`} error={err("seo.description")} />
          </div>
          <AssetUpload kind="og" label="Imagem de partilha (Open Graph)" value={c.seo.ogImage} onChange={(ogImage) => set("seo", { ...c.seo, ogImage })} hint="Imagem mostrada quando o site é partilhado nas redes sociais (1200 × 630 px recomendado)." />
        </div>
      </TabPanel>

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Descartar o rascunho?"
        description="As alterações não publicadas são perdidas e o editor volta à versão publicada."
        confirmLabel="Descartar"
        onConfirm={async () => {
          const r = await discardContentDraft();
          setConfirmDiscard(false);
          if (r.ok) {
            toast(r.message ?? "Descartado.");
            window.location.reload();
          } else toast(r.message, "error");
        }}
      />
    </div>
  );
}

function ItemTools({ onUp, onDown, onRemove }: { onUp: () => void; onDown: () => void; onRemove: () => void }) {
  return (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={onUp} className="rounded-sm p-1.5 text-metal hover:text-white" aria-label="Mover para cima">
        <ArrowUp className="size-4" />
      </button>
      <button type="button" onClick={onDown} className="rounded-sm p-1.5 text-metal hover:text-white" aria-label="Mover para baixo">
        <ArrowDown className="size-4" />
      </button>
      <button type="button" onClick={onRemove} className="rounded-sm p-1.5 text-metal hover:text-danger" aria-label="Remover">
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
