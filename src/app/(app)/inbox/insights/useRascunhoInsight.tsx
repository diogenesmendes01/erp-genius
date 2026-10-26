"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";
import type { PropsPainelInsights } from "./PainelInsights";

type PedidoUso = { token: object; texto: string; geracaoId: string; revisaoEsperada: string };

/** A bridge futura deve conferir a revisão antes de alterar o rascunho físico; este hook não o acessa. */
export function useRascunhoInsight({ atendimentoId, contexto, ativo, autorizado, dados, rascunho }: Pick<PropsPainelInsights,"atendimentoId"|"contexto"|"ativo"|"autorizado"|"dados"|"rascunho">) {
  const ultima = dados.ultima;
  const texto = ultima?.analise.textoSugerido;
  const identidade = ativo && autorizado && rascunho.podeUsar && texto && ultima
    ? JSON.stringify([atendimentoId, contexto, ultima.geracaoId, rascunho.revisao, texto]) : null;
  const [ciclo, setCiclo] = useState<{ identidade: string | null; token: object; pedido: PedidoUso | null; sucesso: string | null; erro: string | null }>(
    () => ({ identidade, token: {}, pedido: null, sucesso: null, erro: null }));
  if (ciclo.identidade !== identidade) setCiclo({ identidade, token: {}, pedido: null, sucesso: null, erro: null });
  const vigente = useRef<object | null>(null);
  const pedidoVigente = useRef<PedidoUso | null>(null);
  const execucao = useAcaoCliente({ idempotente: false });
  useEffect(() => {
    vigente.current = ciclo.token;
    return () => { if (vigente.current === ciclo.token) { vigente.current = null; pedidoVigente.current = null; } };
  }, [ciclo.token]);

  function concluir(pedido: PedidoUso) {
    if (vigente.current !== pedido.token || pedidoVigente.current !== pedido) return;
    pedidoVigente.current = null;
    setCiclo(anterior => anterior.token === pedido.token
      ? { ...anterior, pedido: null, sucesso: "Texto inserido no rascunho.", erro: null } : anterior);
  }
  async function executarUso(pedido: PedidoUso): Promise<Resultado> {
    if (vigente.current !== pedido.token || pedidoVigente.current !== pedido) return { ok: false, erro: "O contexto ou o rascunho mudou. Revise a sugestão novamente." };
    return rascunho.usar({ texto: pedido.texto, geracaoId: pedido.geracaoId, revisaoEsperada: pedido.revisaoEsperada });
  }
  async function pedirUso() {
    if (!identidade || !texto || !ultima || execucao.ocupado || vigente.current !== ciclo.token) return;
    const pedido = { token: ciclo.token, texto, geracaoId: ultima.geracaoId, revisaoEsperada: rascunho.revisao };
    if (rascunho.textoAtual.trim()) {
      pedidoVigente.current = pedido;
      setCiclo(anterior => anterior.token === pedido.token ? { ...anterior, pedido, sucesso: null, erro: null } : anterior);
      return;
    }
    const desfecho = await execucao.executar(() => { pedidoVigente.current = pedido; return executarUso(pedido); });
    if (!desfecho || vigente.current !== pedido.token) return;
    if (desfecho.tipo === "ok") concluir(pedido);
    else setCiclo(anterior => anterior.token === pedido.token ? { ...anterior, erro: desfecho.mensagem, sucesso: null } : anterior);
  }
  const pedido = ciclo.pedido;
  return {
    pedirUso, ocupado: execucao.ocupado, sucesso: ciclo.sucesso, erro: ciclo.erro,
    confirmacao: pedido ? <ConfirmarAcao titulo="Substituir o texto do rascunho?" confirmacao="substituição do rascunho" idempotente={false}
      acao={() => executarUso(pedido)} aoConcluir={() => concluir(pedido)} aoCancelar={() => { if (pedidoVigente.current === pedido) { pedidoVigente.current = null; setCiclo(anterior => ({ ...anterior, pedido: null })); } }}>
      <p>O texto atual do rascunho será substituído pela sugestão. Revise antes de continuar.</p>
    </ConfirmarAcao> : null,
  };
}
