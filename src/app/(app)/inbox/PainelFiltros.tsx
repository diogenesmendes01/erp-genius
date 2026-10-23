"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Chip } from "@/components/Chip";
import { SETOR_ATENDIMENTO_LABEL, STATUS_ATENDIMENTO_LABEL } from "@/lib/labels";
import type { FiltrosInbox } from "@/server/inbox/filtros";
import type { Setor } from "@/server/whatsapp/setor";

export interface PropsPainelFiltros {
  filtros: FiltrosInbox;
  setores: Setor[];
  numeros: { id: string; rotulo: string }[];
}

import { paramsDaUrl } from "./filtros-url";
export { paramsDaUrl } from "./filtros-url";

const CAMPO = "w-full min-w-0 rounded-md border border-gray-300 px-2 py-1.5 text-sm";

export function PainelFiltros({ filtros, setores, numeros }: PropsPainelFiltros) {
  const router = useRouter();
  const caminho = usePathname() ?? "/inbox";
  const [busca, setBusca] = useState(filtros.busca ?? "");

  function ir(novo: FiltrosInbox) {
    const q = paramsDaUrl(novo).toString();
    router.replace(q ? `${caminho}?${q}` : caminho);
  }
  const mudar = (parte: Partial<FiltrosInbox>) => ir({ ...filtros, ...parte });

  // Abas rápidas = atalhos dos mesmos filtros (resp, naoLidas, prazo); mantêm setor, número, status e busca.
  const limpo: Partial<FiltrosInbox> = { responsavel: undefined, naoLidas: undefined, prazoEstourado: undefined };
  const abas: { rotulo: string; ativa: boolean; parte: Partial<FiltrosInbox> }[] = [
    { rotulo: "Todas", ativa: !filtros.responsavel && !filtros.naoLidas && !filtros.prazoEstourado, parte: limpo },
    { rotulo: "Minhas", ativa: filtros.responsavel === "eu", parte: { ...limpo, responsavel: "eu" } },
    { rotulo: "Fila", ativa: filtros.responsavel === "fila", parte: { ...limpo, responsavel: "fila" } },
    { rotulo: "Não lidas", ativa: !!filtros.naoLidas, parte: { ...limpo, naoLidas: true } },
    { rotulo: "Prazo estourado", ativa: !!filtros.prazoEstourado, parte: { ...limpo, prazoEstourado: true } },
  ];

  return (
    <div className="space-y-2 border-b p-2">
      <form role="search" onSubmit={(e) => { e.preventDefault(); mudar({ busca: busca.trim() || undefined }); }}>
        <input type="search" aria-label="Buscar conversas" placeholder="Buscar" value={busca} maxLength={100}
          onChange={(e) => setBusca(e.target.value)} className={CAMPO} />
      </form>
      <div className="flex flex-wrap gap-1.5">
        {abas.map((a) => <Chip key={a.rotulo} selecionado={a.ativa} onClick={() => mudar(a.parte)}>{a.rotulo}</Chip>)}
      </div>
      <div className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-3">
        <select aria-label="Setor" value={filtros.setor ?? ""} onChange={(e) => mudar({ setor: (e.target.value || undefined) as Setor | undefined })} className={CAMPO}>
          <option value="">Todos os setores</option>
          {setores.map((s) => <option key={s} value={s}>{SETOR_ATENDIMENTO_LABEL[s]}</option>)}
        </select>
        <select aria-label="Número" value={filtros.numeroId ?? ""} onChange={(e) => mudar({ numeroId: e.target.value || undefined })} className={CAMPO}>
          <option value="">Todos os números</option>
          {numeros.map((n) => <option key={n.id} value={n.id}>{n.rotulo}</option>)}
        </select>
        <select aria-label="Status" value={filtros.status ?? ""} onChange={(e) => mudar({ status: (e.target.value || undefined) as FiltrosInbox["status"] })} className={CAMPO}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_ATENDIMENTO_LABEL).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </div>
    </div>
  );
}
