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
    falha: number;
};
const useLayoutCliente = typeof window === "undefined" ? useEffect : useLayoutEffect;
export function useHandoffConversa(props: PropsHandoffConversa) {
    const [modal, setModal] = useState<{
        numero: number;
        handoff: HandoffDoAtendimento;
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
        if (!s.ack && (!p.handoff?.ehResponsavel || p.handoff.acaoId !== s.acaoId))
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
        if (proibido || mudou || perdeu || envioRevogado) {
            s.ativa = false;
            querResposta.current = false;
            retorno.current = proibido || envioRevogado ? null : gatilho.current;
            setConfirmando(false);
            if (mudou)
                setModal(null);
            return;
        }
        if (s.ack && s.responder && l && l.finalizada >= s.minimo) {
            if (l.resultado === "falha" && s.falha !== l.finalizada) {
                s.falha = l.finalizada;
                setConfirmando(false);
                setErro("Não foi possível atualizar a conversa. Tente de novo para confirmar sua permissão.");
            }
            else if (l.resultado === "ok")
                concluir(s);
        }
    }, [props, concluir]);
    useEffect(() => () => { if (sessao.current)
        sessao.current.ativa = false; retorno.current = null; }, []);
    function abrir() {
        const p = atual.current;
        if (!p.handoff || p.item.grupo || p.item.status === "ENCERRADO")
            return;
        if (sessao.current)
            sessao.current.ativa = false;
        const n = ++numero.current;
        sessao.current = { numero: n, acaoId: p.handoff.acaoId, ativa: true, ack: false, responder: false, minimo: 0, falha: -1 };
        querResposta.current = false;
        retorno.current = gatilho.current;
        setErro(null);
        setConfirmando(false);
        setModal({ numero: n, handoff: p.handoff });
    }
    function assumirConfirmado(n: number) {
        const s = sessao.current, p = atual.current;
        if (!s?.ativa || s.numero !== n || p.handoff?.acaoId !== s.acaoId || !p.handoff.podeAssumir)
            return;
        s.ack = true;
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
        if (s.ack)
            concluir(s);
        else {
            s.minimo = atual.current.leitura?.solicitada ?? 0;
            concluir(s);
        }
    }
    function tentar(n: number) { const s = sessao.current; if (!s?.ativa || s.numero !== n || !s.ack)
        return; s.minimo = (atual.current.leitura?.solicitada ?? 0) + 1; setConfirmando(true); setErro(null); atual.current.aoMudar(); }
    const valido = !props.item.grupo && props.item.status !== "ENCERRADO", h = props.handoff;
    const atualModal = modal && (h?.acaoId === modal.handoff.acaoId || confirmando) ? (h?.acaoId === modal.handoff.acaoId ? h : modal.handoff) : null;
    const contextoAtivo = valido && props.leitura?.resultado !== "sem-acesso" && !!atualModal && (confirmando || atualModal.podeAssumir || atualModal.ehResponsavel);
    return {
        faixa: valido && h ? <FaixaHandoff handoff={h} agora={props.agora} aoVerResumo={abrir} gatilhoRef={gatilho}/> : null,
        modal: modal && atualModal ? <ModalResumoHandoff key={modal.numero} atendimentoId={props.item.id} contatoNome={props.item.contatoNome} handoff={atualModal} fuso={props.fuso} contextoAtivo={contextoAtivo} confirmando={confirmando} erroConfirmacao={erro} aoTentarConfirmar={() => tentar(modal.numero)} focoAoFechar={retorno} aoFechar={fechar} aoAssumido={() => assumirConfirmado(modal.numero)} aoResponder={() => responder(modal.numero)}/> : null,
        controleResposta, aoCampoResponder
    };
}
