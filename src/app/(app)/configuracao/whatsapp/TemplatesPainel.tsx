"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCloudDownload, IconPencil, IconPlus, IconSend, IconX } from "@tabler/icons-react";
import type { TemplateConfig } from "@/server/whatsapp/consultas";
import {
  salvarTemplateWhatsApp,
  sincronizarTemplatesMeta,
  submeterTemplateMeta,
} from "@/server/whatsapp/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente, type MensagemSucesso } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";

// TEMPLATES (doc 26 §Camada 2 — entidade única, ciclo duplo):
// - Mapeador (Marco 1): "Sincronizar com a Meta" espelha o status da WABA (e importa
//   aprovados criados por fora) — pré-requisito do go-live em número oficial;
// - Editor (Marco 2): criar/editar com variáveis amigáveis; submeter → em revisão →
//   aprovado/rejeitado (via webhook). Em número Baileys todo template vale no ato.

const btnPri = "rounded-md bg-brand-solid px-3 py-1.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60";
const btnSec = "rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50";
const inputCls = "w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: "rascunho", cls: "bg-gray-100 text-gray-600" },
  EM_REVISAO: { label: "em revisão", cls: "bg-amber-100 text-amber-700" },
  APROVADO: { label: "aprovado", cls: "bg-green-100 text-green-700" },
  REJEITADO: { label: "rejeitado", cls: "bg-red-100 text-red-700" },
};

interface FormTemplate {
  id?: string;
  nome: string;
  corpo: string;
  idioma: string;
  categoria: "utility" | "marketing";
}

const FORM_VAZIO: FormTemplate = { nome: "", corpo: "", idioma: "es", categoria: "utility" };

export function TemplatesPainel({ templates }: { templates: TemplateConfig[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormTemplate | null>(null);
  // Nenhuma das actions (sincronizar, submeter, salvar) recebe chave de idempotência: resultado
  // incerto manda conferir antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  // O resultado aparece onde o botão foi clicado: cabeçalho (sincronizar), linha do template
  // (submeter, pelo id) ou formulário (salvar).
  const [origem, setOrigem] = useState<string | null>(null);
  const ocupado = acao.ocupado;

  async function run<T>(secao: string, disparar: () => Promise<Resultado<T>>, sucesso: MensagemSucesso<T>) {
    setOrigem(secao);
    const d = await acao.executar(disparar, sucesso);
    if (d?.tipo === "ok") router.refresh();
    return d;
  }
  const feedback = (secao: string) => (
    <FeedbackAcao erro={origem === secao ? acao.erro : null} sucesso={origem === secao ? acao.sucesso : null} className="mt-3" />
  );

  async function sincronizar() {
    await run("sincronizar", () => sincronizarTemplatesMeta(), (d) =>
      `Sincronizado com a WABA: ${d!.total} template(s) lá, ${d!.atualizados} atualizado(s), ${d!.importados} importado(s).`);
  }

  async function salvar() {
    if (!form) return;
    const dados = form;
    const d = await run("form", () => salvarTemplateWhatsApp(dados), "Template salvo.");
    if (d?.tipo === "ok") setForm(null);
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium">Templates</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Uma entidade só, ciclo duplo: a Meta aprova para o número oficial; no Baileys todo texto vale.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className={btnSec} disabled={ocupado} onClick={sincronizar} title="Mapeador: espelha o status da WABA">
            <span className="flex items-center gap-1">
              <IconCloudDownload className="h-3.5 w-3.5" /> Sincronizar com a Meta
            </span>
          </button>
          <button className={btnPri} disabled={ocupado} onClick={() => setForm(FORM_VAZIO)}>
            <span className="flex items-center gap-1">
              <IconPlus className="h-4 w-4" /> Novo template
            </span>
          </button>
        </div>
      </div>

      {feedback("sincronizar")}

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
        {templates.map((t) => {
          const badge = STATUS_BADGE[t.statusMeta] ?? STATUS_BADGE.RASCUNHO;
          const posicional = /\{\{\d+\}\}/.test(t.corpo);
          return (
            <div key={t.id} className="border-b border-gray-100 px-4 py-3 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{t.nome}</span>
                  <span className="text-xs text-gray-400">{t.idioma} · {t.categoria}</span>
                  <span className={"rounded-full px-2 py-0.5 text-[11px] " + badge.cls}>{badge.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {(t.statusMeta === "RASCUNHO" || t.statusMeta === "REJEITADO") && (
                    <button
                      className={btnSec}
                      disabled={ocupado}
                      onClick={() => run(t.id, () => submeterTemplateMeta(t.id), "Template submetido — a Meta responde pelo webhook.")}
                    >
                      <span className="flex items-center gap-1">
                        <IconSend className="h-3.5 w-3.5" /> Submeter à Meta
                      </span>
                    </button>
                  )}
                  <button
                    className={btnSec}
                    onClick={() =>
                      setForm({
                        id: t.id,
                        nome: t.nome,
                        corpo: t.corpo,
                        idioma: t.idioma,
                        categoria: (t.categoria === "marketing" ? "marketing" : "utility"),
                      })
                    }
                  >
                    <span className="flex items-center gap-1">
                      <IconPencil className="h-3.5 w-3.5" /> Editar
                    </span>
                  </button>
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs text-gray-500">{t.corpo}</p>
              {posicional && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Corpo com variáveis posicionais {"{{n}}"} (importado da Meta) — troque pelas amigáveis{" "}
                  {"{nome} {valor} {vencimento} {link}"} para a régua preencher.
                </p>
              )}
              {feedback(t.id)}
            </div>
          );
        })}
        {templates.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-400">Nenhum template — rode o seed ou crie o primeiro.</p>
        )}
      </div>

      {form && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">{form.id ? "Editar template" : "Novo template"}</span>
            <button className="text-gray-400 hover:text-gray-700" onClick={() => setForm(null)} aria-label="Fechar">
              <IconX className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-gray-600">
              Nome (padrão Meta)
              <input
                className={inputCls + " mt-1"}
                placeholder="cobranca_vencida"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </label>
            <label className="text-xs text-gray-600">
              Idioma
              <input
                className={inputCls + " mt-1"}
                placeholder="es · pt_BR · en"
                value={form.idioma}
                onChange={(e) => setForm({ ...form, idioma: e.target.value })}
              />
            </label>
            <label className="text-xs text-gray-600">
              Categoria
              <select
                className={inputCls + " mt-1"}
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value as FormTemplate["categoria"] })}
              >
                <option value="utility">utility (cobrança/transacional)</option>
                <option value="marketing">marketing</option>
              </select>
            </label>
          </div>
          <label className="mt-3 block text-xs text-gray-600">
            Corpo — variáveis: {"{nome} {valor} {vencimento} {link}"}
            <textarea
              className={inputCls + " mt-1"}
              rows={3}
              value={form.corpo}
              onChange={(e) => setForm({ ...form, corpo: e.target.value })}
            />
          </label>
          <p className="mt-1 text-[11px] text-gray-400">
            Editar um template aprovado volta o status para rascunho — re-submeta à Meta depois. A Meta limita a
            frequência de submissões e pode reclassificar utility → marketing.
          </p>
          {/* Erro dentro do card, colado ao "Salvar" — o formulário continua aberto para corrigir. */}
          <FeedbackAcao erro={origem === "form" ? acao.erro : null} className="mt-3" />
          <div className="mt-3 flex justify-end">
            <button className={btnPri} disabled={ocupado} onClick={salvar}>
              {ocupado ? "Salvando…" : "Salvar template"}
            </button>
          </div>
        </div>
      )}
      {/* O card fecha no sucesso; "Template salvo." é anunciado aqui, numa região sempre montada. */}
      <FeedbackAcao erro={null} sucesso={!form && origem === "form" ? acao.sucesso : null} className="mt-3" />
    </section>
  );
}
