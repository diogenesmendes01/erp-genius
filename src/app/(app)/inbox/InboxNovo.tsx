"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Papel } from "@prisma/client";
import { IconArrowLeft, IconLayoutSidebarRight } from "@tabler/icons-react";
import { Avatar } from "@/components/Avatar";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Drawer } from "@/components/Drawer";
import { ItemLista } from "@/components/ItemLista";
import { BalaoMensagem } from "@/components/conversa/BalaoMensagem";
import { Compositor, MOTIVO_SEM_ENVIO } from "@/components/conversa/Compositor";
import { VirtualList } from "@/components/conversa/VirtualList";
import { recursoDisponivel } from "@/components/conversa/recursos-canal";
import { useConversa } from "@/components/conversa/useConversa";
import { SETOR_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";
import type { AvisoInbox } from "@/server/inbox/barramento";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import type { FiltrosInbox } from "@/server/inbox/filtros";
import { enviarMidiaInbox, enviarTextoInbox } from "@/server/whatsapp/acoes";
import { registrarNotaAtendimento } from "@/server/whatsapp/acoes-conversa";
import { useEventosInbox } from "./useEventosInbox";

export type VistaInbox = "lista" | "conversa" | "painel";

export interface PropsInboxNovo {
  inicial: { itens: ItemListaInbox[]; proximo: string | null };
  filtros: FiltrosInbox;
  selecionado: string | null;
  usuario: { id: string; papeis: Papel[] };
  fuso: string | null;
}

/** Filtros no formato da URL de `GET /api/inbox/atendimentos` (inverso de `lerFiltrosInbox`). */
export function paramsDosFiltros(f: FiltrosInbox, cursor?: string | null): string {
  const q = new URLSearchParams();
  if (f.setor) q.set("setor", f.setor);
  if (f.numeroId) q.set("numeroId", f.numeroId);
  if (f.responsavel) q.set("responsavel", f.responsavel);
  if (f.status) q.set("status", f.status);
  if (f.naoLidas) q.set("naoLidas", "1");
  if (f.prazoEstourado) q.set("prazo", "estourado");
  if (f.busca) q.set("busca", f.busca);
  if (cursor) q.set("cursor", cursor);
  return q.toString();
}

async function buscarPagina(filtros: FiltrosInbox, cursor: string | null): Promise<{ itens: ItemListaInbox[]; proximo: string | null } | null> {
  try {
    const r = await fetch(`/api/inbox/atendimentos?${paramsDosFiltros(filtros, cursor)}`, { cache: "no-store", credentials: "same-origin" });
    return r.ok ? await r.json() as { itens: ItemListaInbox[]; proximo: string | null } : null;
  } catch { return null; }
}

/** Troca as linhas já conhecidas pelas da primeira página e põe no topo as que ainda não estavam na lista. */
export function mesclarPrimeiraPagina(atual: ItemListaInbox[], nova: ItemListaInbox[]): ItemListaInbox[] {
  const novas = new Map(nova.map((i) => [i.id, i]));
  const conhecidos = new Set(atual.map((i) => i.id));
  return [...nova.filter((i) => !conhecidos.has(i.id)), ...atual.map((i) => novas.get(i.id) ?? i)];
}

function horaCurta(iso: string | null, fuso: string | null): string {
  if (!iso) return "";
  try { return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: fuso ?? "UTC" }).format(new Date(iso)); } catch { return ""; }
}

// Breakpoints do protótipo (mobile.js): <700px uma vista por vez; 700–1099px lista + conversa com o painel em Drawer;
// ≥1100px as três colunas.
const COLUNA_LISTA = "min-[700px]:flex min-[700px]:w-[320px] min-[700px]:shrink-0 min-[1100px]:w-[360px]";
const COLUNA_CONVERSA = "min-[700px]:flex min-[700px]:min-w-0 min-[700px]:flex-1";

export function InboxNovo({ inicial, filtros, selecionado: selecionadoInicial, fuso }: PropsInboxNovo) {
  const [itens, setItens] = useState(inicial.itens);
  const [proximo, setProximo] = useState(inicial.proximo);
  const [selecionado, setSelecionado] = useState(selecionadoInicial);
  const [vista, setVista] = useState<VistaInbox>(selecionadoInicial ? "conversa" : "lista");
  const [eventoRecente, setEventoRecente] = useState<AvisoInbox | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const rolagem = useRef<HTMLDivElement>(null);

  // Aviso do SSE: a thread se reconcilia em `useConversa` (recebe o aviso); a lista recarrega só a primeira página
  // e troca as linhas afetadas, sem refazer a página inteira.
  const aoAviso = useCallback((a: AvisoInbox) => {
    setEventoRecente(a);
    void buscarPagina(filtros, null).then((p) => { if (p) setItens((atual) => mesclarPrimeiraPagina(atual, p.itens)); });
  }, [filtros]);
  const { conectado } = useEventosInbox(aoAviso);
  const conversa = useConversa(selecionado, eventoRecente);

  const atual = useMemo(() => itens.find((i) => i.id === selecionado) ?? null, [itens, selecionado]);

  function abrir(id: string) {
    setSelecionado(id);
    setVista("conversa");
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("c", id);
      window.history.replaceState(null, "", url);
    } catch { /* sem history: a seleção vale só nesta tela */ }
  }

  async function maisAntigas() {
    if (!proximo || carregandoMais) return;
    setCarregandoMais(true);
    const p = await buscarPagina(filtros, proximo);
    if (p) {
      setItens((atualLista) => { const ids = new Set(atualLista.map((i) => i.id)); return [...atualLista, ...p.itens.filter((i) => !ids.has(i.id))]; });
      setProximo(p.proximo);
    }
    setCarregandoMais(false);
  }

  const painel = atual ? (
    <div className="space-y-2 p-4 text-sm">
      <p className="font-medium">{atual.contatoNome}</p>
      <p className="text-gray-600">{atual.contatoTelefone}</p>
      <p className="text-gray-600">{atual.numeroRotulo} · {rotular(SETOR_ATENDIMENTO_LABEL, atual.finalidade)}</p>
    </div>
  ) : <p className="p-4 text-sm text-gray-600">Escolha uma conversa para ver os detalhes.</p>;

  return (
    <div data-vista={vista} data-conectado={conectado ? "1" : "0"} className="flex h-[calc(100dvh-8rem)] min-h-[420px] overflow-hidden rounded-item border">
      <section aria-label="Conversas" className={`${vista === "lista" ? "flex" : "hidden"} w-full flex-col border-r ${COLUNA_LISTA}`}>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {itens.length === 0 && <EstadoVazio bloco>Nenhuma conversa neste filtro.</EstadoVazio>}
          {itens.map((i) => (
            <ItemLista
              key={i.id}
              titulo={i.contatoNome}
              resumo={i.preview ?? ""}
              inicio={<Avatar nome={i.contatoNome} />}
              meta={<span className="flex flex-col items-end gap-1"><span>{horaCurta(i.ultimaMensagemEm, fuso)}</span>{i.naoLidas > 0 && <span className="rounded-full bg-brand px-1.5 text-on-brand">{i.naoLidas}</span>}</span>}
              selecionado={i.id === selecionado}
              onClick={() => abrir(i.id)}
            />
          ))}
          {proximo && <button type="button" onClick={() => void maisAntigas()} disabled={carregandoMais} className="w-full p-3 text-sm text-brand-800">Carregar mais</button>}
        </div>
      </section>

      <section aria-label="Conversa" className={`${vista === "conversa" ? "flex" : "hidden"} w-full min-w-0 flex-col ${COLUNA_CONVERSA}`}>
        {!selecionado ? (
          <div className="m-auto p-6 text-center text-gray-600">
            <p className="font-medium">Escolha uma conversa</p>
            <p className="text-sm">As mensagens aparecem aqui.</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b p-3">
              <button type="button" aria-label="Voltar para a lista" onClick={() => setVista("lista")} className="min-[700px]:hidden"><IconArrowLeft size={20} aria-hidden /></button>
              <span className="min-w-0 flex-1 truncate font-medium">{atual?.contatoNome ?? "Conversa"}</span>
              <button type="button" aria-label="Detalhes da conversa" onClick={() => setVista("painel")} className="min-[1100px]:hidden"><IconLayoutSidebarRight size={20} aria-hidden /></button>
            </header>
            <div ref={rolagem} className="min-h-0 flex-1 overflow-y-auto p-3">
              {conversa.temMaisAntes && <button type="button" onClick={() => void conversa.maisAntigas()} disabled={conversa.carregandoAntigas} className="mb-2 w-full text-sm text-brand-800">Mensagens anteriores</button>}
              {conversa.erro && <p role="alert" className="text-sm text-red-700">{conversa.erro}</p>}
              <VirtualList
                items={conversa.mensagens}
                getKey={(m) => m.id}
                estimatedHeight={72}
                scrollRef={rolagem}
                renderItem={(m) => (
                  <BalaoMensagem m={m} fuso={fuso} recursos={(r) => (atual ? recursoDisponivel(atual.driver as never, r) : false)}
                    aoComando={(c) => { if (c === "copiar" && m.corpo) void navigator.clipboard?.writeText(m.corpo); }} />
                )}
              />
            </div>
            {atual ? (
              <Compositor
                atendimentoId={atual.id}
                modo="responder"
                podeEnviar
                driver={atual.driver as never}
                aoEnviarTexto={(texto) => enviarTextoInbox({ conversaId: atual.id, texto })}
                aoEnviarMidia={(url, legenda) => enviarMidiaInbox({ conversaId: atual.id, url, legenda })}
                aoNota={(nota) => registrarNotaAtendimento({ atendimentoId: atual.id, nota })}
              />
            ) : <p className="border-t p-3 text-sm text-gray-600">{MOTIVO_SEM_ENVIO}</p>}
          </>
        )}
      </section>

      <aside aria-label="Detalhes" className="hidden w-[320px] shrink-0 overflow-y-auto border-l min-[1100px]:block">{painel}</aside>
      <div className="min-[1100px]:hidden">
        <Drawer open={vista === "painel"} onClose={() => setVista(selecionado ? "conversa" : "lista")} title="Detalhes da conversa">{painel}</Drawer>
      </div>
    </div>
  );
}
