"use client";
import { useState, type MutableRefObject } from "react";
import Link from "next/link";
import { IconCheck, IconChevronDown, IconDeviceMobile } from "@tabler/icons-react";
import type { OpcoesFiltroInbox, SaudeNumero } from "@/server/inbox/opcoes-filtro";
import { PopoverColuna } from "./PopoverColuna";
const PONTO: Record<SaudeNumero, string> = { conectado: "bg-brand-solid", instavel: "bg-amber-600", desconectado: "bg-gray-400" };
export function SeletorNumero({ numeros, selecionado, podeGerenciar, aoEscolher, abertoInicial = false, aberto, aoMudarAbertura, focoAoFechar: focoAoFecharRef }: {
 numeros: OpcoesFiltroInbox["numeros"]; selecionado: string | null; podeGerenciar: boolean; aoEscolher(id: string | null): void;
 abertoInicial?: boolean; aberto?: boolean; aoMudarAbertura?(aberto: boolean): void; focoAoFechar?: MutableRefObject<HTMLElement | null>;
}) {
 const [local, setLocal] = useState(abertoInicial); const visivel = aberto ?? local;
 const escolhido = numeros.find((n) => n.id === selecionado); const conectados = numeros.filter((n) => n.saude === "conectado").length;
 const rotulo = escolhido?.rotulo ?? ("Todos os números · " + conectados + (conectados === 1 ? " conectado" : " conectados"));
 function mudar(v: boolean) { if (aberto === undefined) setLocal(v); aoMudarAbertura?.(v); }
 function escolher(id: string | null) { aoEscolher(id); mudar(false); }
 const opcao = "flex w-full min-h-12 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-surface-muted";
 return <>
  <button type="button" aria-label={rotulo} aria-haspopup="dialog" aria-expanded={visivel} onClick={(e) => { if (focoAoFecharRef) focoAoFecharRef.current = e.currentTarget; mudar(!visivel); }}
   className="flex h-6 max-w-full items-center gap-1.5 text-[12.5px] text-gray-600"><IconDeviceMobile size={13} aria-hidden /><span className="truncate">{rotulo}</span><IconChevronDown size={13} aria-hidden /></button>
  <PopoverColuna titulo="Ver conversas de" aberto={visivel} aoFechar={() => mudar(false)} focoAoFechar={focoAoFecharRef} topo={72}
   rodape={podeGerenciar ? <Link href="/configuracao/whatsapp" className="text-[12.5px] font-medium text-brand-700">Gerenciar números em Configurações</Link> : undefined}>
   <div className="space-y-1">
    <button type="button" aria-pressed={!escolhido} className={opcao} onClick={() => escolher(null)}><span className="flex-1 text-[13px] font-medium">Todos os números</span>{!escolhido && <IconCheck size={14} className="text-brand-700" aria-hidden />}</button>
    {numeros.map((n) => <button type="button" key={n.id} aria-pressed={selecionado === n.id} className={opcao} onClick={() => escolher(n.id)}>
     <span aria-hidden className={"h-2 w-2 shrink-0 rounded-full " + PONTO[n.saude]} /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{n.rotulo}</span>{n.saude === "instavel" && <span className="block text-[11px] text-amber-700">Instável</span>}</span>
     {selecionado === n.id && <IconCheck size={14} className="text-brand-700" aria-hidden />}
    </button>)}
   </div>
  </PopoverColuna>
 </>;
}
