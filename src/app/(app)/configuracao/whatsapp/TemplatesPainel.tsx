"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPencil, IconPlus, IconX } from "@tabler/icons-react";
import type { TemplateConfig } from "@/server/whatsapp/consultas";
import { salvarTemplateWhatsApp } from "@/server/whatsapp/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { useAcaoCliente, type MensagemSucesso } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";
import { useAvisoAoSair } from "@/lib/aviso-ao-sair";
import { templateAlterado } from "./template-alterado";

// TEMPLATES (doc 26 §Camada 2): editor de texto. O motor envia o texto do template como está,
// sem aprovação externa; as variáveis amigáveis são preenchidas pela régua.

const btnPri = botaoClasses({ tamanho: "md" });
const btnSec = botaoClasses({ variante: "secundario", tamanho: "sm" });
const inputCls = "w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500";

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
  // #166, 7º lote: a criação leva a chave da tentativa (o reenvio devolve o template já criado) e a edição grava o
  // estado-alvo (a mesma edição não grava outro Evento).
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveIdempotencia();
  // O resultado aparece no formulário (salvar).
  const [origem, setOrigem] = useState<string | null>(null);
  const ocupado = acao.ocupado;
  useAvisoAoSair(templateAlterado(form, templates)); // docs/43 §6 item 3: editor aberto com alteração não salva

  async function run<T>(secao: string, disparar: () => Promise<Resultado<T>>, sucesso: MensagemSucesso<T>) {
    setOrigem(secao);
    const d = await acao.executar(disparar, sucesso);
    if (d?.tipo === "ok") router.refresh();
    return d;
  }
  async function salvar() {
    if (!form) return;
    const dados = form;
    const d = await run("form", () => salvarTemplateWhatsApp(dados.id ? dados : { ...dados, chaveIdempotencia: tentativa.atual }), "Template salvo.");
    if (!dados.id) tentativa.depoisDo(d);
    if (d?.tipo === "ok") setForm(null);
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium">Templates</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Texto-base das mensagens automáticas. Vale no ato, sem aprovação externa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={btnPri} disabled={ocupado} onClick={() => setForm(FORM_VAZIO)}>
            <span className="flex items-center gap-1">
              <IconPlus className="h-4 w-4" /> Novo template
            </span>
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
        {templates.map((t) => {
          const posicional = /\{\{\d+\}\}/.test(t.corpo);
          return (
            <div key={t.id} className="border-b border-gray-100 px-4 py-3 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{t.nome}</span>
                  <span className="text-xs text-gray-400">{t.idioma} · {t.categoria}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
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
                  Corpo com variáveis posicionais {"{{n}}"} — troque pelas amigáveis{" "}
                  {"{nome} {valor} {vencimento} {link}"} para a régua preencher.
                </p>
              )}
            </div>
          );
        })}
        {templates.length === 0 && (
          <EstadoVazio bloco>Nenhum template — rode o seed ou crie o primeiro.</EstadoVazio>
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
              Nome
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
            <CampoTexto
              className={inputCls + " mt-1"}
              rows={3}
              value={form.corpo}
              onChange={(e) => setForm({ ...form, corpo: e.target.value })}
            />
          </label>
          {/* Erro dentro do card, colado ao "Salvar" — o formulário continua aberto para corrigir. */}
          <FeedbackAcao erro={origem === "form" ? acao.erro : null} className="mt-3" />
          <div className="mt-3 flex justify-end">
            <button type="button" className={btnPri} disabled={ocupado} onClick={salvar}>
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
