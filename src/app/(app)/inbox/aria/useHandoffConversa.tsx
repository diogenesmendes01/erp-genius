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
    podeAssumirAria?: boolean;
    leitura?: LeituraPainelHandoff;
    fuso: string | null;
    agora: Date;
    aoMudar(): void;
};
type Sessao = {
    atendimentoId: string;
    /** GET compatível observado não substitui o ACK, mantido em campo separado. */
    tentativa: { leituraInicial: number; propriaConfirmada: boolean } | null;
    numero: number;
    acaoId: string;
    ativa: boolean;
    ack: boolean;
    responder: boolean;
    minimo: number;
};
/** Apenas retém o recibo da tentativa local; nunca autoriza outra mutação ou foco. */
function transicaoPropria(s: Pick<Sessao, "ativa" | "atendimentoId" | "tentativa"> | null, p: PropsHandoffConversa): boolean {
    const l = p.leitura;
    return !!s?.ativa && !!s.tentativa && p.item.id === s.atendimentoId && !p.item.grupo
        && p.item.status !== "ENCERRADO" && p.handoff === null
        && p.item.responsavelId === p.usuarioId && p.podeAssumirAria === true && p.podeEnviar === true
        && !!l && l.resultado !== "sem-acesso"
        && (s.tentativa.propriaConfirmada || (l.resultado === "ok" && l.finalizada === l.solicitada && l.finalizada > s.tentativa.leituraInicial));
}
const useLayoutCliente = typeof window === "undefined" ? useEffect : useLayoutEffect;
export function useHandoffConversa(props: PropsHandoffConversa) {
    const [modal, setModal] = useState<{
        numero: number;
        atendimentoId: string;
        tentativa: Sessao["tentativa"];
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
        if (!s.ativa || !s.ack || sessao.current !== s || p.podeEnviar !== true || p.podeAssumirAria !== true || !l || l.resultado !== "ok" || l.finalizada !== l.solicitada || l.finalizada < s.minimo)
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
        if (p.podeEnviar !== true || p.podeAssumirAria !== true) {
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
        const l = props.leitura, propria = transicaoPropria(s, props);
        if (propria && s.tentativa && !s.tentativa.propriaConfirmada) {
            s.tentativa.propriaConfirmada = true;
            setModal(m => m?.numero === s.numero && m.tentativa ? { ...m, tentativa: { ...m.tentativa, propriaConfirmada: true } } : m);
        }
        const proibido = props.item.id !== s.atendimentoId || props.item.grupo || props.item.status === "ENCERRADO" || l?.resultado === "sem-acesso";
        const envioRevogado = props.podeEnviar === false && (!!s.tentativa?.propriaConfirmada
            || (s.ack && l?.resultado === "ok" && l.finalizada === l.solicitada && l.finalizada >= s.minimo));
        // Assumir pode remover o handoff do DTO; o ACK só libera foco após nova leitura e envio vigente.
        const mudou = props.handoff?.acaoId !== s.acaoId && (!s.ack || props.handoff != null) && !propria;
        const perdeu = !s.ack && props.handoff?.acaoId === s.acaoId && (props.podeAssumirAria !== true || (!props.handoff.podeAssumir && !props.handoff.ehResponsavel));
        const perdeuResponsabilidade = (!s.ack && s.responder && !propria && (!props.handoff?.ehResponsavel || props.item.responsavelId !== props.usuarioId))
            || (!!s.tentativa?.propriaConfirmada && props.item.responsavelId !== props.usuarioId)
            || (s.ack && l?.resultado === "ok" && l.finalizada === l.solicitada && l.finalizada >= s.minimo && props.item.responsavelId !== null && props.item.responsavelId !== props.usuarioId);
        const perdeuCapacidade = s.ack && props.podeAssumirAria !== true;
        if (proibido || mudou || perdeu || envioRevogado || perdeuResponsabilidade || perdeuCapacidade) {
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
        sessao.current = { atendimentoId: p.item.id, tentativa: null, numero: n, acaoId: p.handoff.acaoId, ativa: true, ack: false, responder: false, minimo: 0 };
        querResposta.current = false;
        retorno.current = gatilho.current;
        setErro(null);
        setConfirmando(false);
        setModal({ numero: n, atendimentoId: p.item.id, tentativa: null, handoff: p.handoff, invalidada: false, aguardandoConfirmacao: false });
    }
    function iniciarAssumir(n: number): boolean {
        const s = sessao.current, p = atual.current;
        if (!s?.ativa || s.numero !== n || p.item.id !== s.atendimentoId || p.handoff?.acaoId !== s.acaoId
            || p.podeAssumirAria !== true || (!p.handoff.podeAssumir && !p.handoff.ehResponsavel)) return false;
        const tentativa = { leituraInicial: p.leitura?.finalizada ?? 0, propriaConfirmada: false };
        s.tentativa = tentativa;
        setModal(m => m?.numero === s.numero ? { ...m, tentativa: { ...tentativa } } : m);
        return true;
    }
    function assumirConfirmado(n: number) {
        const s = sessao.current, p = atual.current;
        if (!s?.ativa || !s.tentativa || s.numero !== n || p.podeAssumirAria !== true ||
            (!transicaoPropria(s, p) && (p.handoff?.acaoId !== s.acaoId || (!p.handoff.podeAssumir && !p.handoff.ehResponsavel))))
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
        if (!s.ack) {
            // Atualizar o painel não substitui a transição MANUAL confirmada.
            setConfirmando(false); setErro(null); p.aoMudar(); return;
        }
        s.responder = true;
        s.minimo = (p.leitura?.solicitada ?? 0) + 1;
        setConfirmando(true);
        setErro(null);
        p.aoMudar();
    }
    const valido = !props.item.grupo && props.item.status !== "ENCERRADO", h = props.handoff;
    // Snapshot imutável para apresentação; o ref continua reservado aos handlers/efeitos.
    const preservarTentativa = transicaoPropria(modal ? { ativa: !modal.invalidada, atendimentoId: modal.atendimentoId, tentativa: modal.tentativa } : null, props);
    const atualModal = modal && (h?.acaoId === modal.handoff.acaoId || preservarTentativa || modal.aguardandoConfirmacao || modal.invalidada) ? (h?.acaoId === modal.handoff.acaoId ? h : modal.handoff) : null;
    // A autorização vem somente do DTO atual; o fallback acima é exclusivamente de leitura.
    const leituraResponsavelPronta = !h?.ehResponsavel || (props.podeEnviar === true && props.leitura?.resultado === "ok" && props.leitura.finalizada === props.leitura.solicitada);
    const erroLeituraResponsavel = h?.ehResponsavel && !modal?.aguardandoConfirmacao && props.leitura?.resultado === "falha" ? "Não foi possível atualizar a conversa. Tente de novo para confirmar sua permissão." : null;
    const contextoAtivo = leituraResponsavelPronta && props.podeAssumirAria === true && !modal?.invalidada && valido && props.leitura?.resultado !== "sem-acesso" && !!atualModal && h?.acaoId === modal?.handoff.acaoId && !!h && (h.podeAssumir || h.ehResponsavel);
    return {
        faixa: valido && h ? <FaixaHandoff handoff={h} agora={props.agora} aoVerResumo={abrir} gatilhoRef={gatilho}/> : null,
        modal: modal && atualModal ? <ModalResumoHandoff key={modal.numero} atendimentoId={props.item.id} contatoNome={props.item.contatoNome} handoff={atualModal} fuso={props.fuso} podeAssumirAria={props.podeAssumirAria === true} contextoAtivo={contextoAtivo} preservarTentativa={preservarTentativa} aoIniciarAssumir={() => iniciarAssumir(modal.numero)} sessaoInvalidada={modal.invalidada} confirmacaoPendente={modal.aguardandoConfirmacao} confirmando={confirmando} erroConfirmacao={erro ?? erroLeituraResponsavel} aoTentarConfirmar={() => tentar(modal.numero)} focoAoFechar={retorno} aoFechar={fechar} aoAssumido={() => assumirConfirmado(modal.numero)} aoResponder={() => responder(modal.numero)}/> : null,
        controleResposta, aoCampoResponder
    };
}
