"use client";

import { useRef } from "react";
import { EstadoVazio } from "@/components/EstadoVazio";
import { VirtualList } from "@/components/conversa/VirtualList";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { ItemConversa } from "./ItemConversa";
import { useAgoraDosPrazos } from "./prazo-vivo";

export interface PropsListaAtendimentos {
  itens: ItemListaInbox[];
  proximo: string | null;
  selecionado: string | null;
  aoSelecionar(id: string): void;
  aoCarregarMais(): void;
  fuso?: string | null;
  usuarioId?: string;
}

export function ListaAtendimentos({ itens, proximo, selecionado, aoSelecionar, aoCarregarMais, fuso = null, usuarioId }: PropsListaAtendimentos) {
  const rolagem = useRef<HTMLDivElement>(null);
  const agora = new Date(useAgoraDosPrazos(itens));

  return (
    <div ref={rolagem} className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1">
      {itens.length === 0 && <EstadoVazio bloco>Nenhuma conversa neste filtro.</EstadoVazio>}
      <VirtualList
        items={itens}
        getKey={(i) => i.id}
        estimatedHeight={104}
        scrollRef={rolagem}
        threshold={100}
        renderItem={(item) => <ItemConversa item={item} selecionado={item.id === selecionado} agora={agora}
          aoSelecionar={() => aoSelecionar(item.id)} usuarioId={usuarioId} fuso={fuso} />}
      />
      {proximo && <button type="button" onClick={aoCarregarMais} className="w-full p-3 text-sm text-brand-800">Carregar mais</button>}
    </div>
  );
}
