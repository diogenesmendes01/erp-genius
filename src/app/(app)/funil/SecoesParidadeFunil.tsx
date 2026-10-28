"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { formatarDataCivil } from "@/lib/data-civil";
import type { ValoresPrevisao } from "@/server/comercial/previsao-schema";
import type { DetalheOportunidade } from "@/server/crm/historico";
import { BlocoB2B } from "@/app/(app)/inbox/abas/BlocoB2B";
import {
  concluirTarefaOportunidade,
  criarTarefaOportunidade,
  definirPrevisaoOportunidade,
  reabrirTarefaOportunidade,
} from "@/server/inbox/acoes-fechamento-painel";

type Props = {
  oportunidade: DetalheOportunidade;
  podeEditarPrevisao: boolean;
  podeTarefas: boolean;
  podeVerEmpresa: boolean;
};

export function SecoesParidadeFunil({ oportunidade: op, podeEditarPrevisao, podeTarefas, podeVerEmpresa }: Props) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: false });
  const [edicao, setEdicao] = useState<{ base: ValoresPrevisao; percentual: string; dia: string } | null>(null);
  const [titulo, setTitulo] = useState("");
  const tarefas = op.tarefas ?? [];

  function atualizar() { router.refresh(); }

  function abrirPrevisao() {
    if (!podeEditarPrevisao) return;
    acao.limpar();
    setEdicao({
      base: { probabilidadePct: op.probabilidadePct, previsaoFechamento: op.previsaoFechamento },
      percentual: op.probabilidadePct === null ? "" : String(op.probabilidadePct),
      dia: op.previsaoFechamento ?? "",
    });
  }

  async function salvarPrevisao(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!edicao || !podeEditarPrevisao || acao.ocupado) return;
    const alteracoes: Partial<ValoresPrevisao> = {};
    const percentual = edicao.percentual.trim() === "" ? null : Number(edicao.percentual);
    const dia = edicao.dia || null;
    if (percentual !== edicao.base.probabilidadePct) alteracoes.probabilidadePct = percentual;
    if (dia !== edicao.base.previsaoFechamento) alteracoes.previsaoFechamento = dia;
    const r = await acao.executar(() => definirPrevisaoOportunidade(op.id, { esperado: edicao.base, alteracoes }), "Previsão atualizada.");
    if (r?.tipo === "ok") { setEdicao(null); atualizar(); }
  }

  async function criarTarefa(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!podeTarefas || acao.ocupado || !titulo.trim()) return;
    const r = await acao.executar(() => criarTarefaOportunidade(op.id, titulo.trim()), "Tarefa criada.");
    if (r?.tipo === "ok") { setTitulo(""); atualizar(); }
  }

  async function alternarTarefa(tarefa: DetalheOportunidade["tarefas"][number]) {
    if (!podeTarefas || acao.ocupado || !tarefa.podeAgir) return;
    const r = await acao.executar(() => tarefa.status === "CONCLUIDA"
      ? reabrirTarefaOportunidade(tarefa.id, tarefa.versao)
      : concluirTarefaOportunidade(tarefa.id, tarefa.versao));
    if (r?.tipo === "ok") atualizar();
  }

  return <div className="space-y-4 border-t border-gray-200 pt-4">
    <section aria-label="Probabilidade e previsão de fechamento" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>Probabilidade</span><span>{op.probabilidadePct === null ? "Não informada" : `${op.probabilidadePct}%`}</span></div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>Previsão de fechamento</span><span>{op.previsaoFechamento ? formatarDataCivil(op.previsaoFechamento) : "Não informada"}</span></div>
      {podeEditarPrevisao && !edicao && <Botao variante="fantasma" tamanho="sm" onClick={abrirPrevisao}>Editar previsão</Botao>}
      {podeEditarPrevisao && edicao && <form onSubmit={(e) => void salvarPrevisao(e)} className="space-y-3">
        <label className="block text-sm">Probabilidade (%)<input aria-label="Probabilidade (%)" className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" type="number" min={0} max={100} step={1} value={edicao.percentual} disabled={acao.ocupado} onChange={(e) => setEdicao({ ...edicao, percentual: e.target.value })} /></label>
        <label className="block text-sm">Previsão de fechamento<input aria-label="Previsão de fechamento" className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" type="date" value={edicao.dia} disabled={acao.ocupado} onChange={(e) => setEdicao({ ...edicao, dia: e.target.value })} /></label>
        <div className="flex flex-wrap gap-2"><Botao type="submit" variante="primario" tamanho="sm" disabled={acao.ocupado}>Salvar previsão</Botao><Botao variante="neutro" tamanho="sm" disabled={acao.ocupado} onClick={() => { setEdicao(null); acao.limpar(); }}>Cancelar</Botao></div>
      </form>}
    </section>

    <section aria-label="Tarefas da oportunidade" className="space-y-2">
      <h3 className="text-sm font-medium">Tarefas da oportunidade</h3>
      {podeTarefas && <form onSubmit={(e) => void criarTarefa(e)} className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-0 flex-1 gap-1 text-sm">Nova tarefa
          <input aria-label="Título da tarefa" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" value={titulo} maxLength={200} disabled={acao.ocupado} onChange={(e) => setTitulo(e.target.value)} />
        </label>
        <Botao type="submit" variante="secundario" tamanho="sm" disabled={acao.ocupado || !titulo.trim()}>Criar tarefa</Botao>
      </form>}
      {!tarefas.length ? <p className="text-sm text-gray-600">Nenhuma tarefa para esta oportunidade.</p> : <ul className="space-y-2">{tarefas.map((t) => {
        const podeAgir = podeTarefas && t.podeAgir;
        return <li key={t.id} className="flex items-start gap-2 text-sm">
          {podeAgir && <input type="checkbox" aria-label={(t.status === "CONCLUIDA" ? "Reabrir " : "Concluir ") + t.titulo} checked={t.status === "CONCLUIDA"} disabled={acao.ocupado || !t.podeAgir} onChange={() => void alternarTarefa(t)} />}
          <span className={t.status === "CONCLUIDA" ? "line-through" : undefined}>{t.titulo}</span>
        </li>;
      })}</ul>}
    </section>

    {op.b2bDetalhes && <BlocoB2B bloco={op.b2bDetalhes} verEmpresa={podeVerEmpresa} />}
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </div>;
}
