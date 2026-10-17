"use client";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { AvisoInbox } from "@/server/inbox/barramento";
import { fonteErp } from "./fonte-erp";
import { HistoricoConversa, historicoVazio, reagirAoAviso, type EstadoHistorico } from "./historico-conversa";

export type ConversaHook = EstadoHistorico & { maisAntigas: () => Promise<void>; maisNovas: () => Promise<void>; recarregar: () => Promise<void> };

/** Histórico paginado de um atendimento; o último aviso do SSE (`mensagem.nova`, `mensagem.status`, `resync`) mantém a janela atual. */
export function useConversa(atendimentoId: string | null, aviso: AvisoInbox | null): ConversaHook {
  const historico = useMemo(() => new HistoricoConversa(fonteErp), []);
  const estado = useSyncExternalStore(historico.subscribe, historico.getState, historico.getState);
  const ultimoAviso = useRef(aviso);
  useEffect(() => {
    if (atendimentoId) void historico.abrir(atendimentoId); else historico.limpar();
    return historico.limpar;
  }, [historico, atendimentoId]);
  useEffect(() => {
    if (aviso === ultimoAviso.current) return;
    ultimoAviso.current = aviso;
    if (atendimentoId && aviso) void reagirAoAviso(historico, atendimentoId, aviso);
  }, [historico, atendimentoId, aviso]);
  const atual = atendimentoId !== null && estado.atendimentoId === atendimentoId ? estado : historicoVazio;
  return { ...atual, maisAntigas: historico.maisAntigas, maisNovas: historico.maisNovas, recarregar: historico.recarregar };
}
