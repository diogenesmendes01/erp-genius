"use client";
import { useState, type RefObject } from "react";
import { IconCheck } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import { SETOR_ATENDIMENTO_LABEL, STATUS_ATENDIMENTO_LABEL } from "@/lib/labels";
import type { FiltrosInbox } from "@/server/inbox/filtros";
import type { Setor } from "@/server/whatsapp/setor";
import { PopoverColuna } from "./PopoverColuna";
export function contarFiltrosAplicados(f: FiltrosInbox): number { return Number(!!f.setor) + Number(!!f.status); }
export function PopoverFiltros({ filtros, setores, aoAplicar, aoFechar, focoAoFechar }: { filtros: FiltrosInbox; setores: Setor[]; aoAplicar(f: FiltrosInbox): void; aoFechar(): void; focoAoFechar?: RefObject<HTMLElement | null> }) {
 const [setor, setSetor] = useState(filtros.setor); const [status, setStatus] = useState(filtros.status);
 function aplicar(limpar = false) { const f = { ...filtros }; delete f.setor; delete f.status; if (!limpar) { if (setor) f.setor = setor; if (status) f.status = status; } aoAplicar(f); aoFechar(); }
 const opcao = "inline-flex h-7 items-center gap-1 rounded-[15px] border px-2.5 text-[12.5px] ";
 return <PopoverColuna titulo="Filtrar conversas" aberto aoFechar={aoFechar} focoAoFechar={focoAoFechar} rodape={<><Botao variante="secundario" onClick={() => aplicar(true)}>Limpar</Botao><Botao className="flex-1" onClick={() => aplicar()}>Mostrar conversas</Botao></>}>
  <div className="space-y-4">
   <fieldset><legend className="mb-2 text-[11px] font-semibold text-gray-600">Setor</legend><div className="flex flex-wrap gap-1.5">{setores.map((s) => <button type="button" key={s} aria-pressed={setor === s} onClick={() => setSetor(setor === s ? undefined : s)} className={opcao + (setor === s ? "border-brand-700 bg-brand-bg text-brand-700" : "border-gray-200 text-gray-600")}>{setor === s && <IconCheck size={12} aria-hidden />}{SETOR_ATENDIMENTO_LABEL[s]}</button>)}</div></fieldset>
   <fieldset><legend className="mb-2 text-[11px] font-semibold text-gray-600">Status</legend><div className="flex flex-wrap gap-1.5">{(Object.keys(STATUS_ATENDIMENTO_LABEL) as NonNullable<FiltrosInbox["status"]>[]).map((s) => <button type="button" key={s} aria-pressed={status === s} onClick={() => setStatus(status === s ? undefined : s)} className={opcao + (status === s ? "border-brand-700 bg-brand-bg text-brand-700" : "border-gray-200 text-gray-600")}>{status === s && <IconCheck size={12} aria-hidden />}{STATUS_ATENDIMENTO_LABEL[s]}</button>)}</div></fieldset>
  </div>
 </PopoverColuna>;
}
