"use client";
import { useEffect, useRef, useState, type ReactNode, type MutableRefObject } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconEdit, IconFilter, IconSearch, IconX } from "@tabler/icons-react";
import { BotaoIcone } from "@/components/BotaoIcone";
import { SETOR_ATENDIMENTO_LABEL, STATUS_ATENDIMENTO_LABEL } from "@/lib/labels";
import type { ContagensChipsInbox, FiltrosInbox } from "@/server/inbox/filtros";
import type { OpcoesFiltroInbox } from "@/server/inbox/opcoes-filtro";
import type { ResumoListaInbox } from "@/server/inbox/contagens";
import { chipsDoInbox, chipAtivo as chipAriaAtivo } from "./chips-inbox";
import { ChipsFiltro, chipsDaColuna } from "./ChipsFiltro";
import { ListaAtendimentos, type PropsListaAtendimentos } from "./ListaAtendimentos";
import { chipAtivo, hrefDosFiltros } from "./filtros-url";
import { PopoverColuna } from "./PopoverColuna";
import { contarFiltrosAplicados, limparFiltrosAplicados, PopoverFiltros } from "./PopoverFiltros";
import { SeletorNumero } from "./SeletorNumero";
export interface PropsColunaConversas extends PropsListaAtendimentos {
 filtros: FiltrosInbox; opcoesFiltro?: OpcoesFiltroInbox; contagens?: ContagensChipsInbox; resumo?: ResumoListaInbox; faixaAria?: ReactNode;
 aoNovaConversa(): void; novaConversa?: ReactNode; novaConversaAberta?: boolean; aoFecharNovaConversa?(): void;
 usuarioId: string; fuso: string | null; podeGerenciarNumeros: boolean; sino?: ReactNode; focoAoFecharPopover?: MutableRefObject<HTMLElement | null>;
}
export function ehAtalhoBusca(e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey?: boolean; isComposing?: boolean; defaultPrevented?: boolean }): boolean {
 return !e.defaultPrevented && !e.isComposing && !e.altKey && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
}
export function ColunaConversas({ filtros, opcoesFiltro, contagens, resumo, faixaAria, aoNovaConversa, novaConversa, novaConversaAberta, aoFecharNovaConversa, podeGerenciarNumeros, sino, focoAoFecharPopover, ...lista }: PropsColunaConversas) {
 const router = useRouter(); const caminho = usePathname() ?? "/inbox";
 const [popover, setPopover] = useState<"filtros" | "numero" | "nova" | null>(null);
 const novaAberta = novaConversaAberta ?? popover === "nova";
 const [selecaoVista, setSelecaoVista] = useState(lista.selecionado);
 if (selecaoVista !== lista.selecionado) { setSelecaoVista(lista.selecionado); setPopover(null); }
 function selecionar(id: string) { setPopover(null); aoFecharNovaConversa?.(); lista.aoSelecionar(id); }
 const [busca, setBusca] = useState(filtros.busca ?? ""); const [buscaVista, setBuscaVista] = useState(filtros.busca);
 if (buscaVista !== filtros.busca) { setBuscaVista(filtros.busca); setBusca(filtros.busca ?? ""); }
 const campoBusca = useRef<HTMLInputElement>(null); const retornoLocal = useRef<HTMLElement | null>(null);
 const focoRetorno = focoAoFecharPopover ?? retornoLocal;
 function fecharNova() { setPopover(null); aoFecharNovaConversa?.(); }
 function abrir(outro: "filtros" | "numero", gatilho = document.activeElement as HTMLElement | null) { focoRetorno.current = gatilho; aoFecharNovaConversa?.(); setPopover(outro); }
 function abrirNova(gatilho: HTMLButtonElement) { focoRetorno.current = gatilho; setPopover(novaConversaAberta === undefined ? "nova" : null); aoNovaConversa(); }
 function aplicar(f: FiltrosInbox) { router.replace(hrefDosFiltros(caminho, f)); }
 // O alvo explícito do cleanup evita devolver ao gatilho depois de Ctrl/MetaK.
 useEffect(() => {
  function atalho(e: KeyboardEvent) {
   if (!ehAtalhoBusca(e)) return;
   e.preventDefault();
   if (popover !== null || novaAberta) { focoRetorno.current = campoBusca.current; setPopover(null); aoFecharNovaConversa?.(); }
   else campoBusca.current?.focus();
  }
  document.addEventListener("keydown", atalho);
  return () => document.removeEventListener("keydown", atalho);
 }, [popover, novaAberta, aoFecharNovaConversa, focoRetorno]);
 const total = contarFiltrosAplicados(filtros, !!resumo);
 type ChaveAplicada = "setor" | "status" | "responsavel" | "naoLidas" | "prazoEstourado";
 const aplicados: { chave: ChaveAplicada; rotulo: string }[] = [];
 if (filtros.setor) aplicados.push({ chave: "setor", rotulo: SETOR_ATENDIMENTO_LABEL[filtros.setor] });
 if (filtros.status) aplicados.push({ chave: "status", rotulo: STATUS_ATENDIMENTO_LABEL[filtros.status] });
 if (resumo) {
  if (filtros.responsavel && (filtros.responsavel !== "fila" || chipAriaAtivo(filtros) !== "fila")) aplicados.push({ chave: "responsavel", rotulo: filtros.responsavel === "eu" ? "Minhas" : filtros.responsavel === "fila" ? "Não atribuídas" : "Responsável selecionado" });
  if (filtros.prazoEstourado && chipAriaAtivo(filtros) !== "sem-resposta") aplicados.push({ chave: "prazoEstourado", rotulo: "Prazo estourado" });
  if (filtros.naoLidas) aplicados.push({ chave: "naoLidas", rotulo: "Não lidas" });

 }
 function remover(chave?: ChaveAplicada) { const novo = chave ? { ...filtros } : limparFiltrosAplicados(filtros, !!resumo); if (chave) delete novo[chave]; aplicar(novo); }
 return <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
  <div className="min-h-0 max-h-[50%] shrink-0 overflow-y-auto">
   <header className="flex items-center gap-2 px-[18px] pb-2.5 pt-[18px]">
    <div className="min-w-0 flex-1"><h1 className="text-xl font-semibold tracking-[-0.01em]">Conversas</h1>
     {opcoesFiltro && <SeletorNumero numeros={opcoesFiltro.numeros} selecionado={filtros.numeroId ?? null} podeGerenciar={podeGerenciarNumeros}
      aberto={!novaAberta && popover === "numero"} aoMudarAbertura={(v) => v ? abrir("numero", focoRetorno.current) : setPopover(null)} focoAoFechar={focoRetorno}
      aoEscolher={(id) => aplicar({ ...filtros, numeroId: id ?? undefined })} />}
    </div>
    <BotaoIcone rotulo="Filtros" ativo={!novaAberta && popover === "filtros"} aria-haspopup="dialog" aria-expanded={!novaAberta && popover === "filtros"} onClick={(e) => popover === "filtros" ? setPopover(null) : abrir("filtros", e.currentTarget)}><IconFilter size={17} aria-hidden />
     {total > 0 && <span aria-hidden className="absolute right-[3px] top-[3px] h-[15px] min-w-[15px] rounded-full bg-brand-solid px-1 font-mono tabular-nums text-[9.5px] font-semibold text-on-brand">{total}</span>}
    </BotaoIcone>
    <BotaoIcone rotulo="Nova conversa" ativo={novaAberta} aria-haspopup="dialog" aria-expanded={novaAberta} disabled={!novaConversa} onClick={(e) => abrirNova(e.currentTarget)}><IconEdit size={17} aria-hidden /></BotaoIcone>
    {sino}
   </header>
   <form role="search" className="px-[18px] pb-3" onSubmit={(e) => { e.preventDefault(); aplicar({ ...filtros, busca: busca.trim() || undefined }); }}>
    <div className="flex h-[38px] items-center gap-2.5 rounded-item bg-surface-muted px-3 text-gray-600"><IconSearch size={15} aria-hidden />
     <input ref={campoBusca} type="search" aria-label="Buscar conversas" aria-keyshortcuts="Meta+K Control+K" placeholder="Buscar conversas e contatos" value={busca} maxLength={100} onChange={(e) => setBusca(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[13.5px]" />
     <span aria-hidden className="rounded-[5px] border border-gray-200 px-[5px] py-px font-mono text-[11px] text-gray-400">⌘K</span>
    </div>
   </form>
   {faixaAria}
   <ChipsFiltro chips={resumo ? chipsDoInbox(resumo.contagens, filtros) : chipsDaColuna(contagens)} ativo={resumo ? chipAriaAtivo(filtros) : chipAtivo(filtros)} filtros={filtros} />
   {aplicados.length > 0 && <div className="flex flex-wrap items-center gap-1.5 px-[18px] pb-2.5">
    {aplicados.map((f) => <span key={f.chave} className="inline-flex h-6 items-center gap-1 rounded-[6px] bg-brand-bg pl-[9px] pr-1 text-xs font-medium text-brand-700">{f.rotulo}<button type="button" aria-label={"Remover filtro " + f.rotulo} onClick={() => remover(f.chave)} className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-highlight"><IconX size={12} aria-hidden /></button></span>)}
    <button type="button" className="text-xs text-gray-600" onClick={() => remover()}>Limpar</button>
   </div>}
  </div>
  <ListaAtendimentos {...lista} aoSelecionar={selecionar} />
  {!novaAberta && popover === "filtros" && <PopoverFiltros filtros={filtros} setores={opcoesFiltro?.setores ?? []} incluirPessoais={!!resumo} aoAplicar={aplicar} aoFechar={() => setPopover(null)} focoAoFechar={focoRetorno} />}
  <PopoverColuna titulo="Nova conversa" aberto={novaAberta && !!novaConversa} aoFechar={fecharNova} focoAoFechar={focoRetorno}>{novaConversa}</PopoverColuna>
 </div>;
}
