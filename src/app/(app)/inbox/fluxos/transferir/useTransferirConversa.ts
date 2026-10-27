"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Resultado } from "@/server/_shared/resultado";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChavesPorAlvo } from "@/lib/chave-idempotencia";
import type { EntradaConfirmacaoTransferir } from "./PopoverTransferir";
import { SETOR_ATENDIMENTO_LABEL } from "@/lib/labels";
import type { OpcoesTransferir } from "./opcoes-transferir";
export interface ComandoTransferirInbox extends EntradaConfirmacaoTransferir { atendimentoId: string; chaveIdempotencia: string }
interface Props { atendimentoId: string; identidade: string; opcoes: OpcoesTransferir; executar(comando: ComandoTransferirInbox): Promise<Resultado>; aoConcluir(mensagem: string): void }
export function useTransferirConversa({ atendimentoId, identidade, opcoes, executar, aoConcluir }: Props) {
  const ancora = useRef<HTMLButtonElement | null>(null);
  const gatilhoRef = useCallback((node: HTMLButtonElement | null) => { ancora.current = node; }, []);
  const acao = useAcaoCliente({ idempotente: true });
  const tentativas = useChavesPorAlvo();
  const chave = JSON.stringify([atendimentoId, identidade, opcoes]);
  const [contexto, setContexto] = useState({ chave, geracao: 0 });
  if (contexto.chave !== chave) setContexto({ chave, geracao: contexto.geracao + 1 });
  const [abertura, setAbertura] = useState<{ geracao: number; token: symbol; id: number } | null>(null);
  const proximaAbertura = useRef(0);
  const ciclo = useRef<{ token: symbol; viva: boolean } | null>(null);
  const atual = useRef({ chave, executar, aoConcluir });
  useEffect(() => {
    atual.current = { chave, executar, aoConcluir };
  }, [chave, executar, aoConcluir]);
  useEffect(() => () => { if (ciclo.current) ciclo.current.viva = false; }, [chave]);
  const invalidada = !!abertura && abertura.geracao !== contexto.geracao;
  function abrir() {
    if (!opcoes.visivel || acao.ocupado || atual.current.chave !== chave) return;
    acao.limpar(); const sessao = { token: Symbol("transferir"), viva: true };
    ciclo.current = sessao; setAbertura({ geracao: contexto.geracao, token: sessao.token, id: ++proximaAbertura.current });
  }
  function fechar() { if (acao.ocupado) return; if (ciclo.current) ciclo.current.viva = false; setAbertura(null); }
  async function confirmar(entrada: EntradaConfirmacaoTransferir) {
    const sessao = ciclo.current;
    if (!sessao?.viva || sessao.token !== abertura?.token || atual.current.chave !== chave || invalidada || acao.ocupado) return;
    const permitido = entrada.alvo.tipo === "pessoa" ? opcoes.pessoas : entrada.alvo.tipo === "aria" ? opcoes.aria : entrada.alvo.tipo === "fila" ? opcoes.filaDoSetor !== null : opcoes.setores.includes(entrada.alvo.setor);
    if (!permitido) return;
    const tentativa = tentativas.para(JSON.stringify([atendimentoId, entrada.alvo, entrada.contexto, entrada.alvo.tipo === "setor" && entrada.anexarResumoAria === true]));
    const comando = { ...entrada, atendimentoId, chaveIdempotencia: tentativa.atual };
    const d = await acao.executar(async () => {
      try { const r = await executar(comando); return sessao.viva && atual.current.chave === chave ? r : { ok: true as const }; }
      catch (e) { if (!sessao.viva || atual.current.chave !== chave) return { ok: true as const }; throw e; }
    });
    if (d?.tipo === "ok" && sessao.viva && atual.current.chave === chave) {
      tentativa.depoisDo(d); sessao.viva = false; setAbertura(null); atual.current.aoConcluir(entrada.alvo.tipo === "pessoa" ? "Atendimento atribuído." : entrada.alvo.tipo === "fila" ? "Devolvido para a fila." : entrada.alvo.tipo === "aria" ? "Atendimento devolvido para a Aria." : `Atendimento transferido para ${SETOR_ATENDIMENTO_LABEL[entrada.alvo.setor]}.`);
    }
  }
  return { ancora, gatilhoRef, abrir, fechar, confirmar, aberturaId: abertura?.id ?? 0, aberto: abertura !== null, ocupado: acao.ocupado, invalidada, erro: acao.erro };
}
