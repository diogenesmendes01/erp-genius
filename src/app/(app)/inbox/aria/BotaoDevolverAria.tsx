"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { IconSparkles } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { devolverParaAria } from "@/server/aria/acoes";

type PropsDevolverAria = { atendimentoId: string; dica: string | null; aoMudar(): void };
export type ControlesDevolverAria = { botao: ReactNode; feedback: ReactNode };
type PropsControlador = PropsDevolverAria & { permitido?: boolean; children(controles: ControlesDevolverAria): ReactNode };

/** A key encerra a tentativa na seleção; mudar a capacidade preserva a conversa e invalida o ACK. */
export function ControladorDevolverAria(props: PropsControlador) {
  return <AcaoDevolverAria key={props.atendimentoId} {...props} />;
}
function AcaoDevolverAria({ atendimentoId, dica, aoMudar, children, permitido = true }: PropsControlador) {
  const acao = useAcaoCliente({ idempotente: true });
  const ciclo = useRef({ ativo: false });
  const limpar = acao.limpar;
  useEffect(() => {
    const atual = { ativo: permitido }; ciclo.current = atual; limpar();
    return () => { atual.ativo = false; };
  }, [permitido, limpar]);
  async function devolver() {
    const atual = ciclo.current;
    if (!permitido || !atual.ativo || acao.ocupado) return;
    const d = await acao.executar(async () => {
      try {
        const r = await devolverParaAria(atendimentoId);
        return atual.ativo ? r : { ok: true as const };
      } catch (erro) {
        if (!atual.ativo) return { ok: true as const };
        throw erro;
      }
    }, () => atual.ativo ? "Aria retomou o atendimento." : null);
    if (d?.tipo === "ok" && atual.ativo) aoMudar();
  }
  const botao = <Botao variante="ia" tamanho="sm" title={dica ?? undefined} aria-label="Devolver para Aria" ocupado={acao.ocupado} onClick={() => void devolver()} className="h-9 shrink-0 max-[699px]:gap-1 max-[699px]:px-2"><IconSparkles size={15} aria-hidden /><span className="min-[1200px]:hidden">Devolver</span><span className="hidden min-[1200px]:inline">Devolver para Aria</span></Botao>;
  const feedback = <div className={acao.erro || acao.sucesso ? "shrink-0 border-b border-gray-200 bg-surface px-3 py-1.5" : undefined}><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /></div>;

  return children({ botao: permitido ? botao : null, feedback: permitido ? feedback : null });
}
/** Uso autônomo mantém feedback junto do botão; no cabeçalho o controlador separa os slots. */
export function BotaoDevolverAria(props: PropsDevolverAria) {
  return <ControladorDevolverAria {...props}>{({ botao, feedback }) => <>{botao}{feedback}</>}</ControladorDevolverAria>;
}
