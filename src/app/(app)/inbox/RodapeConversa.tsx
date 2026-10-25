"use client";

import { useId, useState, useImperativeHandle, type Ref, type KeyboardEvent } from "react";
import { IconLock, IconNote, IconSparkles } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import { Compositor, type PropsCompositor } from "@/components/conversa/Compositor";

type Aba = "responder" | "nota";
export interface ControleResposta { selecionarResponder(): void }
export type PropsRodapeConversa = Omit<PropsCompositor, "modo" | "contido"> & {
  modo: "travado" | "compositor";
  /** Ponte local da conversa: muda a aba sem remontar o compositor/rascunho. */
  controleResposta?: Ref<ControleResposta>;
  abaInicial?: Aba;
  /** Grupos não são atendimentos individuais anotáveis; a action revalida o escopo. */
  podeAnotar?: boolean;
  travado?: { texto: string; aoNota(): void; aoAssumir?: () => void };
};

export function RodapeConversa({ modo, abaInicial = "responder", podeAnotar = true, travado, controleResposta, ...compositor }: PropsRodapeConversa) {
  const uid = useId();
  const [estado, setEstado] = useState(() => ({ atendimentoId: compositor.atendimentoId, aba: abaInicial }));
  if (estado.atendimentoId !== compositor.atendimentoId) setEstado({ atendimentoId: compositor.atendimentoId, aba: abaInicial });
  const selecionada = estado.atendimentoId === compositor.atendimentoId ? estado.aba : abaInicial;
  const aba = !podeAnotar && selecionada === "nota" ? "responder" : selecionada;
  const escolher = (nova: Aba) => { if (nova !== "nota" || podeAnotar) setEstado({ atendimentoId: compositor.atendimentoId, aba: nova }); };
  useImperativeHandle(controleResposta, () => ({ selecionarResponder: () => escolher("responder") }));
  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return;
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const proxima: Aba = !podeAnotar || e.key === "Home" ? "responder" : e.key === "End" ? "nota" : aba === "responder" ? "nota" : "responder";
    escolher(proxima);
    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[proxima === "nota" ? 1 : 0]?.focus({ preventScroll: true });
  }
  return <footer className="shrink-0 border-t border-gray-200 bg-surface px-4 pb-3.5 pt-2.5">
    {modo === "travado" ? <div className="flex min-h-12 flex-wrap items-center gap-3 rounded-lg bg-ai-50 py-[7px] pl-3.5 pr-2">
      <IconSparkles size={17} className="shrink-0 text-ai-700" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-[13.5px]" title={travado?.texto}>{travado?.texto}</p>
      {travado && <Botao variante="neutro" onClick={travado.aoNota}><IconNote size={16} aria-hidden />Nota interna</Botao>}
      {travado?.aoAssumir && <Botao onClick={travado.aoAssumir}>Assumir para responder</Botao>}
    </div> : <>
      <div role="tablist" aria-label="Tipo da mensagem" className="mb-2 flex flex-wrap items-center gap-1.5">
        <button type="button" id={uid + "-responder"} role="tab" aria-selected={aba === "responder"} aria-controls={uid + "-campo"} tabIndex={aba === "responder" ? 0 : -1} onClick={() => escolher("responder")} onKeyDown={aoTeclar} className="inline-flex min-h-11 items-center rounded-item">
          <span className={"inline-flex h-[26px] items-center rounded-[7px] px-2.5 text-xs font-semibold " + (aba === "responder" ? "bg-brand-bg text-brand-700" : "text-gray-600")}>Responder</span>
        </button>
        <button type="button" id={uid + "-nota"} role="tab" aria-selected={aba === "nota"} aria-controls={uid + "-campo"} tabIndex={aba === "nota" ? 0 : -1} disabled={!podeAnotar} onClick={() => escolher("nota")} onKeyDown={aoTeclar} className="inline-flex min-h-11 items-center rounded-item disabled:cursor-not-allowed disabled:opacity-50">
          <span className={"inline-flex h-[26px] items-center gap-1 rounded-[7px] px-2.5 text-xs font-semibold " + (aba === "nota" ? "bg-amber-50 text-amber-700" : "text-gray-600")}><IconLock size={11} aria-hidden />Nota interna</span>
        </button>
        <span className="ml-auto self-center text-xs text-gray-400">/ respostas rápidas</span>
      </div>
      <div role="tabpanel" id={uid + "-campo"} aria-labelledby={uid + "-" + aba}><Compositor {...compositor} modo={aba} contido /></div>
    </>}
  </footer>;
}
