"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";
import { encontrarMensagens, moverAchado } from "./busca-conversa";
import { controleBuscaVisivel, elementoVisivel, ligarAtalhoBusca, rolarAteMensagem } from "./busca-conversa-dom";
type EstadoBusca = { atendimentoId: string | null; aberta: boolean; termo: string; achado: string | null };
const vazia = (atendimentoId: string | null): EstadoBusca => ({atendimentoId, aberta: false, termo: "", achado: null});
export function useBuscaConversa(atendimentoId: string | null, mensagens: readonly Pick<MensagemThread, "id" | "corpo" | "criadoEm" | "apagada">[], rolagem: RefObject<HTMLDivElement | null>, revisaoVisual?: unknown) {
 const [estado, setEstado] = useState<EstadoBusca>(() => vazia(atendimentoId));
 // Ajuste guardado de estado derivado: limpa na troca sem efeito, remount da thread ou pintura com contexto antigo.
 if (estado.atendimentoId !== atendimentoId) setEstado(vazia(atendimentoId));
 const campoRef = useRef<HTMLInputElement>(null), retorno = useRef<HTMLElement | null>(null);
 const aberta = atendimentoId !== null && estado.atendimentoId === atendimentoId && estado.aberta;
 const termo = aberta ? estado.termo : "";
 const achados = useMemo(() => encontrarMensagens(mensagens, termo), [mensagens, termo]);
 const atual = aberta ? (estado.achado && achados.includes(estado.achado) ? estado.achado : achados[0] ?? null) : null;
 // Grava também o primeiro fallback: páginas/SSE posteriores preservam seu ID, não seu índice.
 if (aberta && estado.achado !== atual) setEstado(s => ({...s, achado: atual}));
 const abrir = useCallback((atalho = false) => {
  if (!atendimentoId) return;
  if (campoRef.current) { campoRef.current.focus({preventScroll: true}); return; }
  const regiao = rolagem.current?.closest<HTMLElement>('section[aria-label="Conversa"]');
  if (regiao) {
   const foco = regiao.ownerDocument.activeElement as HTMLElement | null;
   retorno.current = atalho === true && foco && regiao.contains(foco) && elementoVisivel(foco) ? foco : controleBuscaVisivel(regiao, !!foco?.closest('[role="menu"]'));
  }
  setEstado(s => ({...(s.atendimentoId === atendimentoId ? s : vazia(atendimentoId)), aberta: true}));
 }, [atendimentoId, rolagem]);
 const fechar = useCallback(() => {
  setEstado(vazia(atendimentoId));
  const regiao = rolagem.current?.closest<HTMLElement>('section[aria-label="Conversa"]');
  if (regiao) {
   const alvo = retorno.current && regiao.contains(retorno.current) && elementoVisivel(retorno.current) ? retorno.current : controleBuscaVisivel(regiao);
   alvo?.focus({preventScroll: true});
  }
  retorno.current = null;
 }, [atendimentoId, rolagem]);
 const aoMudar = useCallback((termo: string) => setEstado({atendimentoId, aberta: true, termo, achado: null}), [atendimentoId]);
 const navegar = useCallback((direcao: 1 | -1) => setEstado(s => {
  if (s.atendimentoId !== atendimentoId || !s.aberta) return s;
  const anterior = s.achado && achados.includes(s.achado) ? s.achado : achados[0] ?? null;
  return {...s, achado: moverAchado(achados, anterior, direcao)};
 }), [atendimentoId, achados]);
 useEffect(() => {
  if (!atendimentoId) return;
  const regiao = rolagem.current?.closest<HTMLElement>('section[aria-label="Conversa"]');
  if (regiao) return ligarAtalhoBusca(regiao, () => abrir(true));
 }, [atendimentoId, abrir, rolagem]);
 useLayoutEffect(() => { if (aberta) campoRef.current?.focus({preventScroll: true}); }, [aberta, atendimentoId]);
 useLayoutEffect(() => {
  if (!atual || !rolagem.current) return;
  rolarAteMensagem(rolagem.current, atual);
  // Uma nova medição da row pinada pode ajustar seu offset; um único frame recompõe a geometria real.
  const frame = requestAnimationFrame(() => { if (rolagem.current) rolarAteMensagem(rolagem.current, atual); });
  return () => cancelAnimationFrame(frame);
 }, [atual, mensagens, revisaoVisual, rolagem]);
 return {aberta, termo, atual, achados, posicao: atual ? achados.indexOf(atual) + 1 : 0, campoRef, abrir, fechar, aoMudar, navegar};
}
