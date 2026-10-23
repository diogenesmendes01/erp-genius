"use client";
import { useRef, type ReactNode, type RefObject } from "react";
import { IconX } from "@tabler/icons-react";
import { BotaoIcone } from "@/components/BotaoIcone";
import { useDialogo } from "@/lib/dialogo";
/** Diálogo não-modal da coluna: trap/Escape/retorno/pilha; o fundo permanece interativo. */
export function PopoverColuna({ titulo, aberto, aoFechar, topo = 56, rodape, children, focoAoFechar }: {
 titulo: string; aberto: boolean; aoFechar(): void; topo?: 56 | 72; rodape?: ReactNode; children: ReactNode; focoAoFechar?: RefObject<HTMLElement | null>;
}) {
 const caixa = useRef<HTMLDivElement>(null); const fechar = useRef<HTMLButtonElement>(null);
 useDialogo(caixa, { aberto, aoFechar, focoInicial: fechar, focoAoFechar });
 if (!aberto) return null;
 return <div ref={caixa} role="dialog" aria-label={titulo} tabIndex={-1}
  className={"absolute left-3 right-3 z-20 flex max-h-[calc(100%-70px)] min-h-0 flex-col rounded-dialog border border-gray-200 bg-surface shadow-popover max-[699px]:fixed max-[699px]:inset-x-0 max-[699px]:bottom-0 max-[699px]:top-auto max-[699px]:max-h-[85dvh] max-[699px]:rounded-b-none max-[699px]:rounded-t-[18px] " + (topo === 72 ? "top-[72px]" : "top-14")}>
  <header className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
   <h2 className="text-[14.5px] font-semibold">{titulo}</h2><BotaoIcone ref={fechar} rotulo="Fechar" tamanho={28} onClick={aoFechar}><IconX size={16} aria-hidden /></BotaoIcone>
  </header>
  <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
  {rodape && <footer className="flex shrink-0 gap-2 border-t border-gray-200 p-3">{rodape}</footer>}
 </div>;
}
