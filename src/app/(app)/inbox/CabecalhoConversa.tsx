"use client";
import type { ReactNode } from "react";
import type { LinhaEstadoAria } from "./aria/textos-aria";
import { IconChevronLeft, IconSearch, IconArrowsExchange, IconHandStop, IconLayoutSidebarRight } from "@tabler/icons-react";
import { Avatar, tomDoAvatar } from "@/components/Avatar";
import { Botao } from "@/components/Botao";
import { BotaoIcone } from "@/components/BotaoIcone";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { estadoVisualCabecalho, PONTO_TOM, TEXTO_TOM } from "./estado-visual";
import { MenuConversa, type AcoesCabecalho } from "./MenuConversa";

export type AtendimentoAberto = Pick<ItemListaInbox, "id" | "contatoId" | "contatoNome" | "finalidade" | "numeroRotulo" | "status" | "responsavelId" | "responsavelNome" | "grupo">;
export type PropsCabecalhoConversa = { atendimento: AtendimentoAberto; acoes: AcoesCabecalho; linhaAria?: LinhaEstadoAria | null; acoesAria?: ReactNode; painelAberto: boolean; aoAlternarPainel(): void; aoBuscar(): void; usuarioId: string; painelAuto: boolean; buscaAberta: boolean; aoVoltar(): void };
export function CabecalhoConversa({ atendimento, acoes, linhaAria, acoesAria, painelAberto, aoAlternarPainel, aoBuscar, usuarioId, painelAuto, buscaAberta, aoVoltar }: PropsCabecalhoConversa) {
 const visual = estadoVisualCabecalho(atendimento, usuarioId);
 const estado = linhaAria ?? visual.estado;
 return <header className="grid min-h-[68px] shrink-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-[1fr_auto] items-center gap-x-1.5 border-b border-gray-200 bg-surface py-2 pl-2.5 pr-3">
  {/* Identidade e ações quebram pela largura necessária ao conteúdo. O Menu fica fora do containment. */}
  <div className="row-span-2 min-w-0 [container-type:inline-size]"><div className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-2">
  <div className="flex min-w-0 flex-[1_1_20rem] items-center gap-2.5">
  <BotaoIcone tamanho={36} rotulo="Voltar para a lista" onClick={aoVoltar} className="min-[960px]:hidden"><IconChevronLeft size={20} /></BotaoIcone>
  <span className="shrink-0 max-[699px]:hidden"><Avatar nome={atendimento.contatoNome} tamanho={40} tom={tomDoAvatar(atendimento.contatoId)} /></span>
  <div className="min-w-0 flex-1 leading-[1.3]">
   <div className="flex min-w-0 items-center gap-2 max-[699px]:flex-col max-[699px]:items-start max-[699px]:gap-0.5"><p title={atendimento.contatoNome} className="max-w-full truncate text-[15px] font-semibold">{atendimento.contatoNome}</p><span title={visual.status} className="inline-flex h-[18px] max-w-full shrink-0 items-center rounded-[5px] bg-surface-muted px-1.5 text-[10.5px] font-semibold text-gray-600"><span className="truncate">{visual.status}</span></span></div>
   <p title={linhaAria?.dica ?? (estado.texto + " · " + visual.subtitulo)} className="truncate text-[12.5px] text-gray-600"><span aria-hidden className={"mr-1.5 inline-block h-[7px] w-[7px] rounded-full " + PONTO_TOM[estado.tom]} /><span className={"font-semibold " + TEXTO_TOM[estado.tom]}>{estado.texto}</span> · {visual.subtitulo}</p>
  </div>
  </div>
  <div role="group" aria-label="Ações principais da conversa" className="ml-auto flex shrink-0 self-end items-center justify-end gap-1.5">
   <BotaoIcone tamanho={36} rotulo="Buscar na conversa" title="Buscar na conversa" ativo={buscaAberta} onClick={aoBuscar} className="max-[699px]:hidden"><IconSearch size={17} /></BotaoIcone>
   {acoes.transferir && <Botao variante="neutro" ocupado={acoes.transferir.ocupado} onClick={acoes.transferir.aoEscolher} aria-label="Transferir" title={acoes.transferir.rotulo} className="h-9 min-w-9 shrink-0 max-[1199px]:px-2.5 [@container(max-width:575.98px)]:px-2.5 max-sm:min-w-11"><IconArrowsExchange size={15} aria-hidden /><span className="hidden min-[1200px]:[@container(min-width:576px)]:inline">Transferir</span></Botao>}
   {acoesAria}
   {acoes.assumir && <Botao ocupado={acoes.assumir.ocupado} onClick={acoes.assumir.aoEscolher} aria-label="Assumir conversa" title={acoes.assumir.rotulo} className="h-9 min-w-9 shrink-0 max-[699px]:px-2.5 [@container(max-width:431.98px)]:px-2.5 max-sm:min-w-11"><IconHandStop size={15} aria-hidden /><span className="hidden min-[700px]:[@container(min-width:432px)]:inline min-[1200px]:[@container(min-width:576px)]:hidden">Assumir</span><span className="hidden min-[1200px]:[@container(min-width:576px)]:inline">Assumir conversa</span></Botao>}
   <BotaoIcone tamanho={36} rotulo="Painel do contato" ativo={painelAberto} aria-controls="painel-contato" aria-pressed={painelAberto} onClick={aoAlternarPainel} className={painelAuto ? "min-[1400px]:bg-gray-100" : ""}><IconLayoutSidebarRight size={17} /></BotaoIcone>
  </div>
  </div></div>
  <div className="col-start-2 row-start-2 self-end"><MenuConversa itens={acoes.menu} /></div>
 </header>;
}
