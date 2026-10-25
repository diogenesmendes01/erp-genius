"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { HandoffDoAtendimento } from "@/server/aria/handoff-inbox";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import type { ControleResposta } from "../RodapeConversa";
import { FaixaHandoff } from "./FaixaHandoff";
import { ModalResumoHandoff } from "./ModalResumoHandoff";
/** Recibo da aquisição já coordenada pelo InboxNovo; não inicia outra consulta. */
export interface LeituraPainelHandoff {
    solicitada: number;
    finalizada: number;
    resultado: "ok" | "falha" | "sem-acesso" | "pendente";
}
export type PropsHandoffConversa = {
    item: Pick<ItemListaInbox, "id" | "contatoNome" | "grupo" | "status" | "responsavelId">;
    usuarioId: string;
    handoff: HandoffDoAtendimento | null | undefined;
    podeEnviar: boolean | null;
    leitura?: LeituraPainelHandoff;
    fuso: string | null;
    agora: Date;
    aoMudar(): void;
};
type Sessao = {
    numero: number;
    acaoId: string;
    ativa: boolean;
    ack: boolean;
    responder: boolean;
    minimo: number;
};
const useLayoutCliente = typeof window === "undefined" ? useEffect : useLayoutEffect;
export function useHandoffConversa(props: PropsHandoffConversa) {
    const [modal, setModal] = useState<{
        numero: number;
        handoff: HandoffDoAtendimento;
        invalidada: boolean;
        /** Retém resumo após ACK; não é autorização nem indicador de GET em voo. */
        aguardandoConfirmacao: boolean;
    } | null>(null), [confirmando, setConfirmando] = useState(false), [erro, setErro] = useState<string | null>(null);
    const atual = useRef(props), sessao = useRef<Sessao | null>(null), numero = useRef(0), querResposta = useRef(false);
    const gatilho = useRef<HTMLButtonElement>(null), campo = useRef<HTMLTextAreaElement | null>(null), retorno = useRef<HTMLElement | null>(null), controleResposta = useRef<ControleResposta | null>(null);
    const aoCampoResponder = useCallback((no: HTMLTextAreaElement | null) => { campo.current = no; if (querResposta.current)
        retorno.current = no; }, []);
    const fechar = useCallback(() => { if (sessao.current)
        sessao.current.ativa = false; querResposta.current = false; retorno.current = gatilho.current; setModal(null); setConfirmando(false); setErro(null); }, []);
    const concluir = useCallback((s: Sessao) => {
        const p = atual.current, l = p.leitura;
        if (!s.ativa || sessao.current !== s || p.podeEnviar !== true || !l || l.resultado !== "ok" || l.finalizada !== l.solicitada || l.finalizada < s.minimo)
            return;
        if (s.ack && p.item.responsavelId !== p.usuarioId)
            return;
        if (!s.ack && (!p.handoff?.ehResponsavel || p.handoff.acaoId !== s.acaoId || p.item.responsavelId !== p.usuarioId))
            return;
        if (!controleResposta.current)
            return;
        // O callback ref acompanha a troca Nota → Responder antes do cleanup de foco do Modal.
        querResposta.current = true;
        retorno.current = campo.current;
        controleResposta.current.selecionarResponder();
        s.ativa = false;
        setModal(null);
        setConfirmando(false);
        setErro(null);
    }, []);
    const reconciliarResposta = useCallback((s: Sessao) => {
        if (!s.ativa || sessao.current !== s || !s.responder)
            return;
        const p = atual.current, l = p.leitura;
        if (!l) {
            setConfirmando(false);
            setErro("Não foi possível confirmar sua permissão. Tente atualizar a conversa.");
            return;
        }
        if (l.finalizada < s.minimo || l.finalizada !== l.solicitada || l.resultado === "pendente") {
            setConfirmando(true);
            setErro(null);
            return;
        }
        if (l.resultado === "falha") {
            setConfirmando(false);
            setErro("Não foi possível atualizar a conversa. Tente de novo para confirmar sua permissão.");
            return;
        }
        if (l.resultado !== "ok")
            return;
        if (p.podeEnviar !== true) {
            // Voltar a ter permissão não retoma uma intenção antes recusada.
            s.responder = false;
            setConfirmando(false);
            setErro("Você não tem permissão para responder nesta conversa. Atualize para conferir seu acesso.");
            return;
        }
        concluir(s);
    }, [concluir]);
    useLayoutCliente(() => {
        atual.current = props;
        const s = sessao.current;
        if (!s?.ativa)
            return;
        const l = props.leitura, proibido = props.item.grupo || props.item.status === "ENCERRADO" || l?.resultado === "sem-acesso";
        const envioRevogado = s.ack && l?.resultado === "ok" && l.finalizada === l.solicitada && l.finalizada >= s.minimo && props.podeEnviar === false;
        // Assumir pode remover o handoff do DTO; o ACK só libera foco após nova leitura e envio vigente.
        const mudou = props.handoff?.acaoId !== s.acaoId && (!s.ack || props.handoff != null);
        const perdeu = !s.ack && props.handoff?.acaoId === s.acaoId && !props.handoff.podeAssumir && !props.handoff.ehResponsavel;
        const perdeuResponsabilidade = !s.ack && s.responder && (!props.handoff?.ehResponsavel || props.item.responsavelId !== props.usuarioId);
        if (proibido || mudou || perdeu || envioRevogado || perdeuResponsabilidade) {
            s.ativa = false;
            querResposta.current = false;
            retorno.current = proibido || envioRevogado || perdeuResponsabilidade ? null : gatilho.current;
            setConfirmando(false);
            setModal(m => m?.numero === s.numero ? { ...m, invalidada: true } : m);
            if (mudou)
                setModal(null);
            return;
        }
        reconciliarResposta(s);
    }, [props, reconciliarResposta]);
    useEffect(() => () => { if (sessao.current)
        sessao.current.ativa = false; retorno.current = null; }, []);
    function abrir() {
        const p = atual.current;
        if (!p.handoff || p.item.grupo || p.item.status === "ENCERRADO")
            return;
        if (sessao.current)
            sessao.current.ativa = false;
        const n = ++numero.current;
        sessao.current = { numero: n, acaoId: p.handoff.acaoId, ativa: true, ack: false, responder: false, minimo: 0 };
        querResposta.current = false;
        retorno.current = gatilho.current;
        setErro(null);
        setConfirmando(false);
        setModal({ numero: n, handoff: p.handoff, invalidada: false, aguardandoConfirmacao: false });
    }
    function assumirConfirmado(n: number) {
        const s = sessao.current, p = atual.current;
        if (!s?.ativa || s.numero !== n || p.handoff?.acaoId !== s.acaoId || !p.handoff.podeAssumir)
            return;
        s.ack = true;
        setModal(m => m?.numero === s.numero ? { ...m, aguardandoConfirmacao: true } : m);
        s.minimo = (p.leitura?.solicitada ?? 0) + 1;
        setErro(null);
        setConfirmando(true);
        p.aoMudar();
    }
    function responder(n: number) {
        const s = sessao.current;
        if (!s?.ativa || s.numero !== n)
            return;
        s.responder = true;
        if (!s.ack)
            s.minimo = atual.current.leitura?.solicitada ?? 0;
        reconciliarResposta(s);
    }
    function tentar(n: number) {
        const s = sessao.current, p = atual.current;
        if (!s?.ativa || s.numero !== n || (!s.ack && (!p.handoff?.ehResponsavel || p.handoff.acaoId !== s.acaoId || p.item.responsavelId !== p.usuarioId)))
            return;
        s.responder = true;
        s.minimo = (p.leitura?.solicitada ?? 0) + 1;
        setConfirmando(true);
        setErro(null);
        p.aoMudar();
    }
    const valido = !props.item.grupo && props.item.status !== "ENCERRADO", h = props.handoff;
    const atualModal = modal && (h?.acaoId === modal.handoff.acaoId || modal.aguardandoConfirmacao || modal.invalidada) ? (h?.acaoId === modal.handoff.acaoId ? h : modal.handoff) : null;
    // A autorização vem somente do DTO atual; o fallback acima é exclusivamente de leitura.
    const contextoAtivo = !modal?.invalidada && valido && props.leitura?.resultado !== "sem-acesso" && !!atualModal && h?.acaoId === modal?.handoff.acaoId && !!h && (h.podeAssumir || h.ehResponsavel);
    return {
        faixa: valido && h ? <FaixaHandoff handoff={h} agora={props.agora} aoVerResumo={abrir} gatilhoRef={gatilho}/> : null,
        modal: modal && atualModal ? <ModalResumoHandoff key={modal.numero} atendimentoId={props.item.id} contatoNome={props.item.contatoNome} handoff={atualModal} fuso={props.fuso} contextoAtivo={contextoAtivo} sessaoInvalidada={modal.invalidada} confirmacaoPendente={modal.aguardandoConfirmacao} confirmando={confirmando} erroConfirmacao={erro} aoTentarConfirmar={() => tentar(modal.numero)} focoAoFechar={retorno} aoFechar={fechar} aoAssumido={() => assumirConfirmado(modal.numero)} aoResponder={() => responder(modal.numero)}/> : null,
        controleResposta, aoCampoResponder
    };
}
