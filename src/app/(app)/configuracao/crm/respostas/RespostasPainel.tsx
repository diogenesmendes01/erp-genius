"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Resultado } from "@/server/_shared";
import { arquivarRespostaRapidaDaTela, salvarRespostaRapidaDaTela } from "@/server/crm-config/acoes-respostas";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { EstadoVazio } from "@/components/EstadoVazio";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";

import { CampoCombobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
type Setor = "COMERCIAL" | "FINANCEIRO" | "SECRETARIA" | "PEDAGOGICO";
export interface RespostaLinha { id: string; atalho: string; titulo: string; corpo: string; setor: Setor | null; ariaPodeUsar: boolean }
const SETORES: { v: Setor; t: string }[] = [
  { v: "COMERCIAL", t: "Comercial" }, { v: "FINANCEIRO", t: "Financeiro" }, { v: "SECRETARIA", t: "Secretaria" }, { v: "PEDAGOGICO", t: "Pedagógico" },
];
const input = "mt-1 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm";
export const AVISO_ARIA =
  "A Aria usa as respostas marcadas como referência, inclusive os preços citados no texto. Hoje a Aria só atua no Comercial: valem as respostas do Comercial e as gerais; respostas de outros setores marcadas ainda não têm efeito.";
const VARIAVEIS = ["{nome}", "{responsavel}", "{curso}"];

export function RespostasPainel({ respostas, setoresPermitidos }: { respostas: RespostaLinha[]; setoresPermitidos: Setor[] }) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveIdempotencia();
  const [id, setId] = useState<string | undefined>();
  const [atalho, setAtalho] = useState("/");
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [setor, setSetor] = useState<Setor | "">("");
  const [aria, setAria] = useState(false);
  const limpar = () => { setId(undefined); setAtalho("/"); setTitulo(""); setCorpo(""); setSetor(""); setAria(false); };
  const rodar = async (fn: () => Promise<Resultado<unknown>>, depois: () => void, criacao = false) => {
    const d = await acao.executar(fn);
    if (criacao) tentativa.depoisDo(d);
    if (d?.tipo === "ok") { depois(); router.refresh(); }
  };

  return <div className="mt-4 grid gap-6">
    <section aria-label="Respostas cadastradas" className="rounded-lg border border-gray-200 p-4">
      {respostas.length === 0 && <EstadoVazio>Nenhuma resposta rápida cadastrada.</EstadoVazio>}
      <ul className="divide-y divide-gray-100 text-sm">
        {respostas.map((r) => <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
          <span><strong>{r.atalho}</strong> {r.titulo} <span className="text-xs text-gray-500">{SETORES.find((s) => s.v === r.setor)?.t ?? "Geral"}{r.ariaPodeUsar ? " · Aria pode usar" : ""}</span></span>
          <span className="flex gap-3">
            <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "sm" })} onClick={() => { setId(r.id); setAtalho(r.atalho); setTitulo(r.titulo); setCorpo(r.corpo); setSetor(r.setor ?? ""); setAria(r.ariaPodeUsar); }}>Editar</button>
            <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "sm" })} disabled={acao.ocupado} onClick={() => rodar(() => arquivarRespostaRapidaDaTela(r.id), () => { if (id === r.id) limpar(); })}>Arquivar</button>
          </span>
        </li>)}
      </ul>
    </section>
    <section aria-label="Resposta" className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-base font-medium">{id ? "Editar resposta" : "Nova resposta"}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-gray-600">Atalho<input className={input} value={atalho} onChange={(e) => setAtalho(e.target.value)} /></label>
        <label className="text-xs text-gray-600">Título<input className={input} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></label>
        <label className="text-xs text-gray-600">Setor
          <CampoCombobox value={setor} onChange={(e) => setSetor(e.target.value as Setor | "")} className={input} vazio={"Geral (todos os setores)"} opcoes={SETORES.filter((s) => setoresPermitidos.includes(s.v)).map((s) => ({ valor: String(s.v), rotulo: s.t }))} />
        </label>
      </div>
      <label className="mt-3 block text-xs text-gray-600">Texto (variáveis: {VARIAVEIS.join(", ")})
        <CampoTexto className={input} rows={4} value={corpo} onChange={(e) => setCorpo(e.target.value)} />
      </label>
      <label className="mt-3 flex items-center gap-1 text-sm"><Switch checked={aria} onCheckedChange={(marcado) => setAria((marcado === true))} />A Aria pode usar esta resposta</label>
      <p className="mt-1 text-xs text-gray-500">{AVISO_ARIA}</p>
      <button className={`${botaoClasses({ tamanho: "md" })} mt-3`} disabled={acao.ocupado} onClick={() => rodar(() => salvarRespostaRapidaDaTela({ id, atalho, titulo, corpo, setor: setor || null, ariaPodeUsar: aria, ...(id ? {} : { chaveIdempotencia: tentativa.atual }) }), limpar, !id)}>{acao.ocupado ? "Salvando…" : id ? "Salvar resposta" : "Criar resposta"}</button>
    </section>
    <FeedbackAcao erro={acao.erro} />
  </div>;
}
