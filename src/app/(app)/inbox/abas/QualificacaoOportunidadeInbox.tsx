"use client";

import { useState } from "react";
import { Temperatura, type EtapaLead } from "@prisma/client";
import { Botao } from "@/components/Botao";
import { Chip } from "@/components/Chip";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { TEMPERATURA_LABEL } from "@/lib/labels";
import { atualizarResumoNoInbox, definirTemperaturaNoInbox } from "@/server/inbox/acoes-fechamento-painel";

type Resumo = { interesse: string | null; objetivo: string | null; urgencia: string | null; orcamento: string | null; objecao: string | null; proximaAcao: string | null };
type Props = {
  atendimentoId: string;
  oportunidadeId: string;
  temperatura: Temperatura;
  etapa: EtapaLead;
  podeEditar: boolean;
  resumo: Resumo;
  aoMudar(): void;
};

const CAMPOS: { chave: keyof Resumo; rotulo: string }[] = [
  { chave: "proximaAcao", rotulo: "Próxima ação" },
  { chave: "interesse", rotulo: "Interesse" },
  { chave: "objetivo", rotulo: "Objetivo" },
  { chave: "urgencia", rotulo: "Urgência" },
  { chave: "orcamento", rotulo: "Orçamento" },
  { chave: "objecao", rotulo: "Objeção" },
];

const vazio = (resumo: Resumo): Record<keyof Resumo, string> => ({
  proximaAcao: resumo.proximaAcao ?? "",
  interesse: resumo.interesse ?? "",
  objetivo: resumo.objetivo ?? "",
  urgencia: resumo.urgencia ?? "",
  orcamento: resumo.orcamento ?? "",
  objecao: resumo.objecao ?? "",
});

export function QualificacaoOportunidadeInbox({ atendimentoId, oportunidadeId, temperatura, etapa, podeEditar, resumo, aoMudar }: Props) {
  const acao = useAcaoCliente({ idempotente: false });
  const encerrada = etapa === "MATRICULADO" || etapa === "PERDIDO";
  const editavel = podeEditar && !encerrada;
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(() => vazio(resumo));

  async function salvarTemperatura(proxima: Temperatura) {
    if (!editavel || acao.ocupado || proxima === temperatura) return;
    const r = await acao.executar(() => definirTemperaturaNoInbox(atendimentoId, oportunidadeId, proxima), "Temperatura atualizada.");
    if (r?.tipo === "ok") aoMudar();
  }

  async function salvarResumo(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!editavel || acao.ocupado) return;
    const r = await acao.executar(() => atualizarResumoNoInbox(atendimentoId, oportunidadeId, form), "Qualificação atualizada.");
    if (r?.tipo === "ok") { setAberto(false); aoMudar(); }
  }

  return <section aria-label="Qualificação da oportunidade" className="space-y-3">
    <div className="grid gap-1 text-sm">
      <span id="temperatura-inbox">Temperatura</span>
      {editavel ? <div role="group" aria-labelledby="temperatura-inbox" className="flex flex-wrap gap-2">
        {Object.values(Temperatura).map((t) => <Chip key={t} selecionado={temperatura === t} onClick={() => void salvarTemperatura(t)}>{TEMPERATURA_LABEL[t]}</Chip>)}
      </div> : <p>{TEMPERATURA_LABEL[temperatura]}</p>}
    </div>
    <div className="space-y-2">
      {editavel ? <Botao variante="fantasma" tamanho="sm" aria-expanded={aberto} onClick={() => { acao.limpar(); setForm(vazio(resumo)); setAberto((v) => !v); }}>Qualificação e próximo passo</Botao> : <p className="text-sm font-medium">Qualificação e próximo passo</p>}
      {(!editavel || !aberto) && <dl className="space-y-1 text-[13px]">
        {CAMPOS.map(({ chave, rotulo }) => <div key={chave} className="grid min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-2"><dt className="text-gray-600">{rotulo}</dt><dd className="min-w-0 [overflow-wrap:anywhere]">{resumo[chave] || "—"}</dd></div>)}
      </dl>}
      {editavel && aberto && <form onSubmit={(e) => void salvarResumo(e)} className="space-y-2">
        {CAMPOS.map(({ chave, rotulo }) => <label key={chave} className="block text-sm">{rotulo}
          <input className="mt-1 w-full rounded-md border border-border-soft bg-surface p-2" value={form[chave]} disabled={acao.ocupado} maxLength={2000} onChange={(e) => setForm({ ...form, [chave]: e.target.value })} />
        </label>)}
        <Botao type="submit" variante="primario" tamanho="sm" disabled={acao.ocupado}>Salvar qualificação</Botao>
      </form>}
    </div>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </section>;
}
