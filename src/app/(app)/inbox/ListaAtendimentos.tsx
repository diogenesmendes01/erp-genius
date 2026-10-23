"use client";

import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { useRef, useState } from "react";
import { IconUsersGroup } from "@tabler/icons-react";
import { Avatar } from "@/components/Avatar";
import { EstadoVazio } from "@/components/EstadoVazio";
import { ItemLista } from "@/components/ItemLista";
import { VirtualList } from "@/components/conversa/VirtualList";
import { SETOR_ATENDIMENTO_LABEL, STATUS_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";

export interface PropsListaAtendimentos {
  itens: ItemListaInbox[];
  proximo: string | null;
  selecionado: string | null;
  aoSelecionar(id: string): void;
  aoCarregarMais(): void;
  fuso?: string | null;
}

function horaCurta(iso: string | null, fuso: string | null): string {
  return iso ? formatarInstanteExibicao(iso, fuso, "UTC", "hora").texto : "";
}

const estourado = (i: ItemListaInbox, agora: number) =>
  !i.grupo && i.status !== "ENCERRADO" && !!i.prazoRespostaEm && new Date(i.prazoRespostaEm).getTime() < agora;

export function ListaAtendimentos({ itens, proximo, selecionado, aoSelecionar, aoCarregarMais, fuso = null }: PropsListaAtendimentos) {
  const rolagem = useRef<HTMLDivElement>(null);
  const [agora] = useState(() => Date.now());

  function linha(i: ItemListaInbox) {
    // Regra 5: o item nunca mostra telefone (pedagógico em especial); o nome identifica o contato.
    return (
      <ItemLista
        titulo={i.contatoNome}
        resumo={i.preview ?? ""}
        inicio={i.grupo
          ? <span data-testid="icone-grupo" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-bg text-brand-800"><IconUsersGroup size={20} aria-label="Grupo" /></span>
          : <Avatar nome={i.contatoNome} />}
        meta={<span className="flex flex-col items-end gap-1"><span>{horaCurta(i.ultimaMensagemEm, fuso)}</span>{i.naoLidas > 0 && <span className="rounded-full bg-brand-solid px-1.5 text-on-brand">{i.naoLidas}</span>}</span>}
        selecionado={i.id === selecionado}
        onClick={() => aoSelecionar(i.id)}
      />
    );
  }

  return (
    <div ref={rolagem} className="min-h-0 flex-1 overflow-y-auto p-1">
      {itens.length === 0 && <EstadoVazio bloco>Nenhuma conversa neste filtro.</EstadoVazio>}
      <VirtualList
        items={itens}
        getKey={(i) => i.id}
        estimatedHeight={104}
        scrollRef={rolagem}
        threshold={100}
        renderItem={(i) => (
          <div>
            {linha(i)}
            <p className="-mt-2 mb-1 flex flex-wrap gap-x-2 gap-y-0.5 px-3 pb-2 text-xs text-gray-600">
              <span>{rotular(SETOR_ATENDIMENTO_LABEL, i.finalidade)}</span>
              <span>{i.numeroRotulo}</span>
              {!i.grupo && <span>{rotular(STATUS_ATENDIMENTO_LABEL, i.status)}</span>}
              {!i.grupo && i.responsavelNome && <span>{i.responsavelNome}</span>}
              {estourado(i, agora) && <span className="font-medium text-red-700">Prazo estourado</span>}
            </p>
          </div>
        )}
      />
      {proximo && <button type="button" onClick={aoCarregarMais} className="w-full p-3 text-sm text-brand-800">Carregar mais</button>}
    </div>
  );
}
