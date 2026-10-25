"use client";
import { useEffect, useRef, type RefObject } from "react";
import { IconCheck } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import { Modal } from "@/components/Modal";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { assumirAtendimento } from "@/server/whatsapp/acoes-atendimento";
import type { HandoffDoAtendimento } from "@/server/aria/handoff-inbox";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
export type PropsModalResumoHandoff = {
    atendimentoId: string;
    contatoNome: string;
    handoff: HandoffDoAtendimento;
    fuso: string | null;
    aoFechar(): void;
    aoAssumido(): void;
    aoResponder(): void;
    focoAoFechar?: RefObject<HTMLElement | null>;
    contextoAtivo?: boolean;
    confirmando?: boolean;
    erroConfirmacao?: string | null;
    aoTentarConfirmar?(): void;
};
export function ModalResumoHandoff(props: PropsModalResumoHandoff) { return <SessaoResumo key={props.atendimentoId + ":" + props.handoff.acaoId} {...props}/>; }
function SessaoResumo({ atendimentoId, contatoNome, handoff, fuso, aoFechar, aoAssumido, aoResponder, focoAoFechar, contextoAtivo = true, confirmando = false, erroConfirmacao, aoTentarConfirmar }: PropsModalResumoHandoff) {
    const acao = useAcaoCliente({ idempotente: true }), cancelar = useRef<HTMLButtonElement>(null), ciclo = useRef({ ativo: false });
    useEffect(() => { const atual = { ativo: contextoAtivo }; ciclo.current = atual; return () => { atual.ativo = false; }; }, [contextoAtivo, handoff.podeAssumir]);
    async function assumir() {
        const atual = ciclo.current;
        if (!atual.ativo || !handoff.podeAssumir || confirmando)
            return;
        const d = await acao.executar(async () => { try {
            const r = await assumirAtendimento(atendimentoId);
            return atual.ativo ? r : { ok: true as const };
        }
        catch (e) {
            if (!atual.ativo)
                return { ok: true as const };
            throw e;
        } });
        if (d?.tipo === "ok" && atual.ativo) {
            aoAssumido();
            aoResponder();
        }
    }
    const temAcao = handoff.podeAssumir || handoff.ehResponsavel;
    return <Modal titulo="Resumo de handoff" folha aoFechar={aoFechar} bloquearFechamento={acao.ocupado && contextoAtivo} focoInicial={cancelar} focoAoFechar={focoAoFechar}>
  <p className="mb-4 text-sm text-gray-600">Preparado pela Aria · {contatoNome}</p>
  <section className="mb-4"><h4 className="mb-1 text-sm font-semibold">O que o contato quer</h4><p className="whitespace-pre-wrap text-sm">{handoff.resumo?.quer || "A Aria não deixou resumo."}</p></section>
  <section className="mb-4"><h4 className="mb-2 text-sm font-semibold">O que a Aria já fez</h4>{handoff.feito.length ? <ul className="space-y-2">{handoff.feito.map((f, i) => <li key={i} className="flex items-start gap-2 text-sm"><IconCheck size={14} aria-hidden className="mt-0.5 shrink-0 text-ai-700"/><span className="min-w-0 flex-1">{f.texto}</span><time dateTime={f.quando} className="shrink-0 font-mono text-xs tabular-nums text-gray-600">{formatarInstanteExibicao(f.quando, fuso, "UTC", "hora").texto}</time></li>)}</ul> : <p className="text-sm text-gray-600">Nenhuma ação registrada.</p>}</section>
  {handoff.resumo?.proximoPasso && <section className="mb-4 rounded-lg bg-brand-bg p-3"><h4 className="mb-1 text-sm font-semibold">Próxima ação sugerida</h4><p className="whitespace-pre-wrap text-sm">{handoff.resumo.proximoPasso}</p></section>}
  <FeedbackAcao erro={acao.erro ?? erroConfirmacao} progresso={confirmando ? "Atualizando a conversa…" : null}/>
  <div className="mt-4 flex flex-wrap justify-end gap-2">
   <Botao ref={cancelar} variante="fantasma" disabled={acao.ocupado && contextoAtivo} onClick={aoFechar}>{temAcao ? "Cancelar" : "Fechar"}</Botao>
   {erroConfirmacao && aoTentarConfirmar && <Botao variante="secundario" onClick={aoTentarConfirmar}>Tentar de novo</Botao>}
   {handoff.podeAssumir ? <Botao ocupado={acao.ocupado} disabled={!contextoAtivo || confirmando} onClick={() => void assumir()}>Assumir e responder</Botao> : handoff.ehResponsavel ? <Botao disabled={!contextoAtivo || confirmando} onClick={aoResponder}>Responder</Botao> : null}
  </div>
 </Modal>;
}
