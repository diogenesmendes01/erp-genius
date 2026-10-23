"use client";
import type { Ref } from "react";
import { IconChevronUp, IconChevronDown, IconX } from "@tabler/icons-react";
import { BotaoIcone } from "@/components/BotaoIcone";
import { Botao } from "@/components/Botao";
export type PropsBuscaConversa = { termo: string; aoMudar(t: string): void; total: number; posicao: number; aoAnterior(): void; aoProximo(): void; aoFechar(): void; temMaisAntes: boolean; temMaisDepois: boolean; carregandoAntigas: boolean; aoCarregarAntigas(): void; campoRef?: Ref<HTMLInputElement> };
export function BuscaConversa({ campoRef, termo, aoMudar, total, posicao, aoAnterior, aoProximo, aoFechar, temMaisAntes, temMaisDepois, carregandoAntigas, aoCarregarAntigas }: PropsBuscaConversa) {
 return <div onKeyDown={e => { if (!e.defaultPrevented && !e.nativeEvent.isComposing && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); aoFechar(); } }} className="shrink-0 border-b border-gray-200 bg-surface px-3 py-1.5">
  <div className="flex min-h-11 flex-wrap items-center gap-1.5">
   <input ref={campoRef} value={termo} onChange={e => aoMudar(e.target.value)} aria-label="Buscar na conversa" autoComplete="off" className="h-8 min-w-0 flex-[1_1_120px] rounded-item bg-surface-muted px-3 text-[13.5px]"
    onKeyDown={e => { if (e.defaultPrevented || e.nativeEvent.isComposing || e.altKey || e.ctrlKey || e.metaKey) return; if (e.key === "Escape") {e.preventDefault();e.stopPropagation();aoFechar();} else if (e.key === "Enter" && total > 0) {e.preventDefault();if (e.shiftKey) aoAnterior(); else aoProximo();} }} />
   <span role="status" aria-live="polite" className="font-mono text-xs tabular-nums text-gray-600">{total ? posicao + " de " + total : "Nenhuma"}</span>
   <BotaoIcone tamanho={34} rotulo="Anterior" disabled={!total} onClick={aoAnterior} className="max-[699px]:min-h-11 max-[699px]:min-w-11"><IconChevronUp size={16} /></BotaoIcone>
   <BotaoIcone tamanho={34} rotulo="Próxima" disabled={!total} onClick={aoProximo} className="max-[699px]:min-h-11 max-[699px]:min-w-11"><IconChevronDown size={16} /></BotaoIcone>
   <BotaoIcone tamanho={34} rotulo="Fechar busca" onClick={aoFechar} className="max-[699px]:min-h-11 max-[699px]:min-w-11"><IconX size={16} /></BotaoIcone>
  </div>
  {(temMaisAntes || temMaisDepois) && <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600"><p>Busca nas mensagens carregadas.{temMaisDepois ? " Há mensagens mais novas fora desta janela." : ""}</p>{temMaisAntes && <Botao variante="fantasma" tamanho="sm" disabled={carregandoAntigas} ocupado={carregandoAntigas} onClick={aoCarregarAntigas}>Carregar anteriores</Botao>}</div>}
 </div>;
}
