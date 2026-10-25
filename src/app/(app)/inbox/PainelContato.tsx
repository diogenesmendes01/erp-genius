"use client";

import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { IconChevronLeft, IconSparkles, IconX, IconPencil } from "@tabler/icons-react";
import { Avatar, tomDoAvatar } from "@/components/Avatar";
import type { TagPainel } from "@/server/inbox/paineis";
export type { TagPainel } from "@/server/inbox/paineis";
import { Botao } from "@/components/Botao";
import { BotaoIcone } from "@/components/BotaoIcone";
import { useDialogo } from "@/lib/dialogo";
import { isolarFundoDoPainel } from "./isolamento-painel";
const useEfeitoDeLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type IdAbaPainel = "detalhes" | "oportunidades" | "insights" | "atividade";
export type ContatoPainel = { id: string; nome: string; subtitulo: string; tags: readonly TagPainel[]; quadrado?: boolean };
export type AbaPainel = { id: IdAbaPainel; rotulo: string; contagem?: number };
export const ABAS_ENTREGUES: readonly IdAbaPainel[] = Object.freeze(["detalhes", "oportunidades", "atividade"]);
const ROTULOS: Record<IdAbaPainel, string> = { detalhes: "Detalhes", oportunidades: "Oportunidades", insights: "Insights", atividade: "Atividade" };
const COMERCIAIS: readonly IdAbaPainel[] = ["oportunidades", "insights"];
export function abasDoPainel(finalidade: string): AbaPainel[] {
  return ABAS_ENTREGUES.filter(id => !COMERCIAIS.includes(id) || finalidade === "COMERCIAL").map(id => ({ id, rotulo: ROTULOS[id] }));
}
const ativaValida = (abas: readonly AbaPainel[], ativa: IdAbaPainel) => abas.find(a => a.id === ativa)?.id ?? abas[0]?.id ?? "detalhes";
export function AbasPainel({ abas, abaAtiva, aoTrocarAba, idBase }: { abas: readonly AbaPainel[]; abaAtiva: IdAbaPainel; aoTrocarAba(id: IdAbaPainel): void; idBase?: string }) {
  const gerado = useId(), base = idBase ?? gerado, lista = useRef<HTMLDivElement>(null), ativa = ativaValida(abas, abaAtiva);
  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    if (!abas.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const origem = (e.target as HTMLElement).closest('[role="tab"]')?.getAttribute('data-aba');
    const indice = abas.findIndex(a => a.id === origem);
    if (indice < 0) return;
    e.preventDefault();
    const destino = e.key === "Home" ? 0 : e.key === "End" ? abas.length - 1 : (indice + (e.key === "ArrowLeft" ? -1 : 1) + abas.length) % abas.length;
    const id = abas[destino].id;
    aoTrocarAba(id);
    lista.current?.querySelector<HTMLButtonElement>('[data-aba="' + id + '"]')?.focus();
  }
  return <div role="tablist" aria-label="Abas do painel do contato" ref={lista} onKeyDown={teclado} className="flex border-b border-gray-200 px-2 pt-1.5">
    {abas.map(a => <button key={a.id} type="button" role="tab" data-aba={a.id} id={base + "-tab-" + a.id} aria-controls={base + "-conteudo"} aria-selected={a.id === ativa} tabIndex={a.id === ativa ? 0 : -1} onClick={() => aoTrocarAba(a.id)}
      className={"flex h-[38px] flex-auto items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-1.5 text-[13px] font-semibold " + (a.id === ativa ? "border-brand-solid text-gray-800" : "border-transparent text-gray-600")}>
      {a.rotulo}{a.contagem !== undefined && <span className="rounded-[10px] bg-ai-50 px-1.5 py-px font-mono tabular-nums text-[10.5px] font-medium text-ai-700">{a.contagem}</span>}
    </button>)}
  </div>;
}

/** Uma montagem para coluna, sobreposição e vista própria: não perde campos ao redimensionar. */
export function PainelContato({ visivel, sobreposto, className, aoFechar, children, focarAoAbrir = false, contato, slotTags, slotAviso, aoEditar, abas = abasDoPainel(""), abaAtiva = "detalhes", aoTrocarAba }: {
  visivel: boolean | null; sobreposto: boolean; className: string; aoFechar(): void; children?: ReactNode; focarAoAbrir?: boolean;
  contato?: ContatoPainel; aoEditar?(): void; slotTags?: ReactNode; slotAviso?: ReactNode; abas?: readonly AbaPainel[]; abaAtiva?: IdAbaPainel; aoTrocarAba?(id: IdAbaPainel): void;
}) {
  const idBase = useId();
  const painel = useRef<HTMLElement>(null);
  const fechar = useRef<HTMLButtonElement>(null);
  const visivelAnterior = useRef(visivel);
  useEffect(() => {
    const caixa = painel.current;
    if (!caixa) return;
    const focoDentro = caixa.contains(document.activeElement);
    caixa.inert = visivel === false;
    if (visivel && visivelAnterior.current === false && focarAoAbrir && !sobreposto) fechar.current?.focus();
    visivelAnterior.current = visivel;
    if (focoDentro && visivel === false) document.querySelector<HTMLButtonElement>('button[aria-controls="painel-contato"]')?.focus();
  }, [visivel, focarAoAbrir, sobreposto]);
  useDialogo(painel, { aberto: sobreposto, aoFechar, focoInicial: fechar });
  const soltarFundo = useRef<(() => void) | undefined>(undefined);
  // Layout solta antes do cleanup passivo de useDialogo tentar devolver o foco.
  useEfeitoDeLayout(() => {
    if (!sobreposto) return;
    return () => { soltarFundo.current?.(); };
  }, [sobreposto]);
  // Registrado depois de useDialogo: primeiro captura o gatilho e foca; só então isola.
  useEffect(() => {
    if (!sobreposto || !painel.current) return;
    const soltar = isolarFundoDoPainel(painel.current);
    soltarFundo.current = soltar;
    return () => { soltar(); if (soltarFundo.current === soltar) soltarFundo.current = undefined; };
  }, [sobreposto]);
  const botaoFechar = contato ? <div className="absolute left-2.5 top-2.5">
    <BotaoIcone tamanho={36} ref={fechar} rotulo="Fechar painel do contato" aria-labelledby={idBase + "-fechar"} onClick={aoFechar}>
      <span className="min-[700px]:hidden"><IconChevronLeft size={20} aria-hidden /></span><span className="hidden min-[700px]:inline"><IconX size={20} aria-hidden /></span>
      <span id={idBase + "-fechar"} className="sr-only"><span className="min-[700px]:hidden">Voltar para a conversa</span><span className="hidden min-[700px]:inline">Fechar painel</span></span>
    </BotaoIcone>
  </div> : <Botao variante="fantasma" tamanho="sm" ref={fechar} aria-label="Fechar painel do contato" onClick={aoFechar} className="min-h-10">Fechar</Botao>;
  return (
    <aside id="painel-contato" ref={painel} aria-label="Painel do contato" role={sobreposto ? "dialog" : undefined}
      aria-modal={sobreposto ? true : undefined} aria-hidden={visivel === false ? true : undefined} tabIndex={-1}
      className={className} onKeyDown={(e) => {
        if (sobreposto || e.defaultPrevented || e.key !== "Escape") return;
        const alvo = e.target as Element;
        // Portais propagam pelo pai React: a confirmação filha deve consumir seu próprio Escape.
        if (!e.currentTarget.contains(alvo) || alvo.closest('[role="dialog"], [role="alertdialog"]')) return;
        e.stopPropagation(); aoFechar();
      }}>
      {!contato && <header className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 p-3">
        <h2 className="font-medium">Painel do contato</h2>{botaoFechar}
      </header>}
      {/* Uma rolagem local inclui cabeçalho/abas: tags extensas nunca expulsam o conteúdo em tela baixa. */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {contato && <header data-cabecalho-contato className="relative flex flex-col items-center gap-3.5 border-b border-gray-200 px-6 pb-[26px] pt-9">
          {botaoFechar}
          {aoEditar && <div className="absolute right-2.5 top-2.5"><BotaoIcone tamanho={34} rotulo="Editar contato" onClick={aoEditar} className="max-sm:min-h-11 max-sm:min-w-11"><IconPencil size={18} aria-hidden /></BotaoIcone></div>}
          <Avatar nome={contato.nome} tamanho={132} tom={tomDoAvatar(contato.id)} quadrado={contato.quadrado} />
          <h2 className="max-w-full text-balance text-center text-xl font-medium leading-[1.25] [overflow-wrap:anywhere]">{contato.nome}</h2>
          <p className="max-w-full text-center text-sm text-gray-600 [overflow-wrap:anywhere]">{contato.subtitulo}</p>
          {slotTags !== undefined ? slotTags : contato.tags.length > 0 && <div className="flex max-w-full flex-wrap justify-center gap-1.5">{contato.tags.map(tag => <span key={tag.id} className="inline-flex min-h-[26px] items-center gap-[5px] rounded-[13px] bg-surface-muted px-2.5 text-[12.5px] [overflow-wrap:anywhere]">
            {tag.ia && <IconSparkles size={11} className="shrink-0 text-ai-700" aria-label="Criada pela Aria" />}{tag.rotulo}
          </span>)}</div>}
        </header>}
        {slotAviso}
        {contato && <AbasPainel abas={abas} abaAtiva={abaAtiva} aoTrocarAba={id => aoTrocarAba?.(id)} idBase={idBase} />}
        <div role={contato ? "tabpanel" : undefined} id={contato ? idBase + "-conteudo" : undefined} aria-labelledby={contato ? idBase + "-tab-" + ativaValida(abas, abaAtiva) : undefined}
          className={contato ? "flex min-h-0 flex-col gap-5 px-[18px] pb-6 pt-4" : undefined}>{children}</div>
      </div>
    </aside>
  );
}
