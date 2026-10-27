"use client";

import { useId, useState, useImperativeHandle, type Ref, type KeyboardEvent } from "react";
import { IconLock, IconNote, IconSparkles, IconListCheck } from "@tabler/icons-react";
import { BotaoIcone } from "@/components/BotaoIcone";
import { Botao } from "@/components/Botao";
import { Compositor, type PropsCompositor } from "@/components/conversa/Compositor";

type Aba = "responder" | "nota";
export interface ControleResposta { selecionarResponder(): void }
export type PropsRodapeConversa = Omit<PropsCompositor, "modo" | "contido" | "pedidoFoco"> & {
  modo: "travado" | "compositor";
  controleResposta?: Ref<ControleResposta>;
  abaInicial?: Aba;
  pedidoNota?: number;
  aoCriarTarefa?: () => void;
  podeAnotar?: boolean;
  travado?: { texto: string; aoNota(): void; aoAssumir?: () => void; ocupado?: boolean };
};

export function RodapeConversa({ modo, abaInicial = "responder", podeAnotar = true, travado, controleResposta, pedidoNota, aoCriarTarefa, ...compositor }: PropsRodapeConversa) {
  const uid = useId();
  const pedido=pedidoNota??0;
  const novoContexto=()=>({atendimentoId:compositor.atendimentoId,aba:pedido>0&&podeAnotar?"nota" as const:abaInicial,pedido,foco:pedido>0&&podeAnotar?pedido:undefined as number|undefined});
  const [estado,setEstado]=useState(novoContexto);
  if(estado.atendimentoId!==compositor.atendimentoId)setEstado(novoContexto());
  else if(estado.pedido!==pedido)setEstado({...estado,pedido,aba:pedido>0&&podeAnotar?"nota":estado.aba,foco:pedido>0&&podeAnotar?pedido:undefined});
  const selecionada = estado.atendimentoId === compositor.atendimentoId ? estado.aba : abaInicial;
  const aba = !podeAnotar && selecionada === "nota" ? "responder" : selecionada;
  const barra = modo === "travado" && aba !== "nota";
  const escolher = (nova: Aba) => { if ((nova !== "nota" || podeAnotar) && (nova !== "responder" || modo !== "travado")) setEstado(e => ({ ...e, atendimentoId: compositor.atendimentoId, aba: nova })); };
  useImperativeHandle(controleResposta, () => ({ selecionarResponder: () => escolher("responder") }));
  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return;
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const proxima: Aba = modo === "travado" && podeAnotar ? "nota" : !podeAnotar || e.key === "Home" ? "responder" : e.key === "End" ? "nota" : aba === "responder" ? "nota" : "responder";
    escolher(proxima);
    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[proxima === "nota" ? 1 : 0]?.focus({ preventScroll: true });
  }
  return <footer className="shrink-0 border-t border-gray-200 bg-surface px-4 pb-3.5 pt-2.5">
    {barra ? <div className="flex min-h-12 flex-wrap items-center gap-3 rounded-lg bg-ai-50 py-[7px] pl-3.5 pr-2">
      <IconSparkles size={17} className="shrink-0 text-ai-700" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-[13.5px]" title={travado?.texto}>{travado?.texto}</p>
      {aoCriarTarefa && <BotaoIcone rotulo="Nova tarefa" tamanho={36} onClick={aoCriarTarefa}><IconListCheck size={18}/></BotaoIcone>}
      {travado && podeAnotar && <Botao variante="neutro" onClick={() => { escolher("nota"); travado.aoNota(); }}><IconNote size={16} aria-hidden />Nota interna</Botao>}
      {travado?.aoAssumir && <Botao ocupado={travado.ocupado} onClick={travado.aoAssumir}>Assumir para responder</Botao>}
    </div> : null}
      <div role="tablist" hidden={barra} aria-label="Tipo da mensagem" className="mb-2 flex flex-wrap items-center gap-1.5">
        <button type="button" id={uid + "-responder"} role="tab" aria-selected={aba === "responder"} aria-controls={uid + "-campo"} tabIndex={aba === "responder" ? 0 : -1} disabled={modo === "travado"} onClick={() => escolher("responder")} onKeyDown={aoTeclar} className="inline-flex min-h-11 items-center rounded-item">
          <span className={"inline-flex h-[26px] items-center rounded-[7px] px-2.5 text-xs font-semibold " + (aba === "responder" ? "bg-brand-bg text-brand-700" : "text-gray-600")}>Responder</span>
        </button>
        <button type="button" id={uid + "-nota"} role="tab" aria-selected={aba === "nota"} aria-controls={uid + "-campo"} tabIndex={aba === "nota" ? 0 : -1} disabled={!podeAnotar} onClick={() => escolher("nota")} onKeyDown={aoTeclar} className="inline-flex min-h-11 items-center rounded-item disabled:cursor-not-allowed disabled:opacity-50">
          <span className={"inline-flex h-[26px] items-center gap-1 rounded-[7px] px-2.5 text-xs font-semibold " + (aba === "nota" ? "bg-amber-50 text-amber-700" : "text-gray-600")}><IconLock size={11} aria-hidden />Nota interna</span>
        </button>
        {aoCriarTarefa && <BotaoIcone rotulo="Nova tarefa" tamanho={36} onClick={aoCriarTarefa}><IconListCheck size={18}/></BotaoIcone>}
        <span className="ml-auto self-center text-xs text-gray-400">/ respostas rápidas</span>
      </div>
      <div role="tabpanel" id={uid + "-campo"} aria-labelledby={uid + "-" + aba}><Compositor {...compositor} modo={aba} pedidoFoco={aba==="nota"?estado.foco:undefined} bloqueioExterno={modo === "travado"} contido /></div>

  </footer>;
}
