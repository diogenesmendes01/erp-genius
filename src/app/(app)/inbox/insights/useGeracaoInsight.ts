"use client";

import { useEffect, useRef, useState } from "react";
import { useAcaoCliente, type DesfechoAcao } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";

export interface PortaGeracaoInsight {
  atendimentoId: string;
  contexto: string;
  ativo: boolean;
  /** Audiência/contexto ainda autorizados; não confundir com PROCESSANDO impedir novo clique. */
  autorizado: boolean;
  podeAtualizar: boolean;
  gerar: (entrada: { atendimentoId: string; chaveTentativa: string }) => Promise<Resultado<{ geracaoId: string }>>;
  aoSolicitarLeitura: () => void;
  novaChave?: () => string;
}
type Feedback = Exclude<DesfechoAcao<unknown>, { tipo: "ok" }> | null;

/** Porta local sem fetch ou action importada. Apenas clique explícito pode iniciar geração. */
export function useGeracaoInsight({ atendimentoId, contexto, ativo, autorizado, podeAtualizar,
  gerar, aoSolicitarLeitura, novaChave = () => crypto.randomUUID() }: PortaGeracaoInsight) {
  const identidade = ativo && autorizado ? JSON.stringify([atendimentoId, contexto]) : null;
  const [ciclo, setCiclo] = useState<{ identidade: string | null; token: object; feedback: Feedback }>(
    () => ({ identidade, token: {}, feedback: null }));
  if (ciclo.identidade !== identidade) setCiclo({ identidade, token: {}, feedback: null });
  const vigente = useRef<object | null>(null);
  // Chave não autoriza retry automático: uma falha de transporte pode ter consumido IA.
  const execucao = useAcaoCliente({ idempotente: false });
  useEffect(() => {
    vigente.current = ciclo.token;
    return () => { if (vigente.current === ciclo.token) vigente.current = null; };
  }, [ciclo.token]);

  async function atualizar() {
    const token = ciclo.token;
    if (!identidade || !podeAtualizar || execucao.ocupado || ciclo.feedback?.tipo === "incerto"
      || vigente.current !== token) return;
    const desfecho = await execucao.executar(() => gerar({ atendimentoId, chaveTentativa: novaChave() }));
    if (!desfecho || vigente.current !== token) return;
    setCiclo(anterior => anterior.token === token
      ? { ...anterior, feedback: desfecho.tipo === "ok" ? null : desfecho } : anterior);
    // Mesmo quando o SSE próprio já chegou, o ACK solicita uma leitura NOVA.
    // Nenhum foco/inserção de rascunho é concedido por esse ACK.
    if (desfecho.tipo === "ok" || desfecho.tipo === "incerto") aoSolicitarLeitura();
  }
  return {
    atualizar,
    ocupado: execucao.ocupado,
    erro: ciclo.feedback?.mensagem ?? null,
    incerto: ciclo.feedback?.tipo === "incerto",
  };
}
