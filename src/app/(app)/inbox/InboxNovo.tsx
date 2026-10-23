"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Papel } from "@prisma/client";
import { Drawer } from "@/components/Drawer";
import { useConversa } from "@/components/conversa/useConversa";
import { SETOR_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";
import type { AvisoInbox } from "@/server/inbox/barramento";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import type { ContagensChipsInbox, FiltrosInbox } from "@/server/inbox/filtros";
import type { OpcoesFiltroInbox } from "@/server/inbox/opcoes-filtro";
import type { PainelSetor as DadosPainelSetor } from "@/server/inbox/paineis";
import { marcarAtendimentoLido } from "@/server/whatsapp/preferencias";
import { ConversaAberta } from "./ConversaAberta";
import type { ItemTriagem, RevisaoEnvio } from "@/server/whatsapp/operacoes-atendimento";
import type { DestinoTransferencia } from "./AcoesAtendimento";
import { ListaAtendimentos } from "./ListaAtendimentos";
import { AcoesContato } from "./AcoesContato";
import { OptOutContato } from "./OptOutContato";
import { PainelAria } from "./PainelAria";
import { PainelFiltros } from "./PainelFiltros";
import { PainelSetor } from "./PainelSetor";
import { PainelTriagem } from "./PainelTriagem";
import { useEventosInbox } from "./useEventosInbox";
import { criarMarcadorDeLeitura } from "./marcar-lida";

export type VistaInbox = "lista" | "conversa" | "painel";
type EstadoLeitura = { id: string | null; versao: number; fase: "nenhuma" | "pendente" | "sucesso" | "falha"; ultimaContagem: number };

export interface PropsInboxNovo {
  inicial: { itens: ItemListaInbox[]; proximo: string | null };
  filtros: FiltrosInbox;
  selecionado: string | null;
  usuario: { id: string; papeis: Papel[] };
  fuso: string | null;
  /** Destinos de transferência com contexto (FINANCEIRO/PEDAGOGICO), de `listarOpcoesAtendimento`. */
  destinos?: DestinoTransferencia[];
  /** Triagem e revisão de envio (Task 33): nulas para quem `listarTriagemWhatsApp` / `listarRevisoesEnvio` recusam. */
  triagem?: ItemTriagem[] | null;
  revisoes?: RevisaoEnvio[] | null;
  /** Setores e números do PainelFiltros (`opcoesFiltroInbox`); sem eles a barra de filtros não aparece. */
  opcoesFiltro?: OpcoesFiltroInbox;
  /** Agregados autorizados; a apresentação em chips é entregue pela etapa 313. */
  contagens?: ContagensChipsInbox;
}

/** Filtros no formato da URL de `GET /api/inbox/atendimentos` (inverso de `lerFiltrosInbox`). */
export function paramsDosFiltros(f: FiltrosInbox, cursor?: string | null, opcoes: { contagens?: boolean } = {}): string {
  const q = new URLSearchParams();
  if (f.setor) q.set("setor", f.setor);
  if (f.numeroId) q.set("numeroId", f.numeroId);
  if (f.responsavel) q.set("responsavel", f.responsavel);
  if (f.status) q.set("status", f.status);
  if (f.naoLidas) q.set("naoLidas", "1");
  if (f.prazoEstourado) q.set("prazo", "estourado");
  if (f.busca) q.set("busca", f.busca);
  if (cursor) q.set("cursor", cursor);
  else if (opcoes.contagens) q.set("contagens", "1");
  return q.toString();
}

type PaginaInbox = { itens: ItemListaInbox[]; proximo: string | null; contagens?: ContagensChipsInbox };

async function buscarPagina(filtros: FiltrosInbox, cursor: string | null): Promise<PaginaInbox | null> {
  try {
    const r = await fetch(`/api/inbox/atendimentos?${paramsDosFiltros(filtros, cursor, { contagens: true })}`, { cache: "no-store", credentials: "same-origin" });
    return r.ok ? await r.json() as PaginaInbox : null;
  } catch { return null; }
}

/**
 * Troca as linhas já conhecidas pelas da primeira página, põe no topo as novas e remove as que saíram do filtro:
 * sem `proximo` a primeira página é a lista inteira; com `proximo`, o que é tão recente quanto a última linha da
 * página e não veio nela já não pertence à lista.
 */
export function mesclarPrimeiraPagina(atual: ItemListaInbox[], nova: ItemListaInbox[], proximo: string | null = null, manterId: string | null = null): ItemListaInbox[] {
  if (!proximo) {
    const fixo = manterId ? atual.find((i) => i.id === manterId) : undefined;
    return fixo && !nova.some((i) => i.id === fixo.id) ? [fixo, ...nova] : nova;
  }
  const novas = new Map(nova.map((i) => [i.id, i]));
  const conhecidos = new Set(atual.map((i) => i.id));
  const limite = nova[nova.length - 1]?.ultimaMensagemEm ?? null;
  const manter = (i: ItemListaInbox) => novas.has(i.id) || !limite || i.id === manterId || !i.ultimaMensagemEm || i.ultimaMensagemEm < limite;
  return [...nova.filter((i) => !conhecidos.has(i.id)), ...atual.filter(manter).map((i) => novas.get(i.id) ?? i)];
}

/** A leitura recém-aberta aparece imediatamente na lista, antes da próxima consulta. */
export function zerarNaoLidas(itens: ItemListaInbox[], id: string): ItemListaInbox[] {
  const pos = itens.findIndex((item) => item.id === id && item.naoLidas !== 0);
  if (pos < 0) return itens;
  return itens.map((item, indice) => indice === pos ? { ...item, naoLidas: 0 } : item);
}

export function avisoMarcaLida(aviso: AvisoInbox, selecionado: string | null): boolean {
  return aviso.tipo === "mensagem.nova" && aviso.atendimentoId !== null && aviso.atendimentoId === selecionado;
}

/** Painel por setor (`GET /api/inbox/atendimentos/[id]/painel`): null fora do escopo ou em falha de rede. */
/** Painel do atendimento; "sem-acesso" no 404 (fora do escopo, ex.: convite revogado); null em outra falha. */
async function buscarPainel(id: string): Promise<DadosPainelSetor | "sem-acesso" | null> {
  try {
    const r = await fetch(`/api/inbox/atendimentos/${encodeURIComponent(id)}/painel`, { cache: "no-store", credentials: "same-origin" });
    if (r.status === 404) return "sem-acesso";
    return r.ok ? await r.json() as DadosPainelSetor : null;
  } catch { return null; }
}

/** Lista vazia de triagem/revisão vale como ausência (nenhum painel com "· 0"). */
const ouNulo = <T,>(l: T[] | null): T[] | null => (l?.length ? l : null);

// Breakpoints do protótipo (mobile.js): <700px uma vista por vez; 700–1099px lista + conversa com o painel em Drawer;
// ≥1100px as três colunas.
const COLUNA_LISTA = "min-[700px]:flex min-[700px]:w-[320px] min-[700px]:shrink-0 min-[1100px]:w-[360px]";
const COLUNA_CONVERSA = "min-[700px]:flex min-[700px]:min-w-0 min-[700px]:flex-1";

export function InboxNovo({ inicial, filtros, selecionado: selecionadoInicial, usuario, fuso, destinos, triagem: triagemBruta = null, revisoes: revisoesBrutas = null, opcoesFiltro, contagens: contagensIniciais }: PropsInboxNovo) {
  const triagem = ouNulo(triagemBruta);
  const revisoes = ouNulo(revisoesBrutas);
  const [itens, setItens] = useState(() => selecionadoInicial ? zerarNaoLidas(inicial.itens, selecionadoInicial) : inicial.itens);
  // Estado produtor reservado aos chips (#313), sem inventar contagem pelo tamanho da página.
  const [, setContagens] = useState(contagensIniciais);
  const possuiContagensRef = useRef(contagensIniciais !== undefined);
  const [proximo, setProximo] = useState(inicial.proximo);
  const [selecionado, setSelecionado] = useState(selecionadoInicial);
  const [vista, setVista] = useState<VistaInbox>(selecionadoInicial ? "conversa" : "lista");
  const [eventoRecente, setEventoRecente] = useState<AvisoInbox | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  // Filtro novo (o PainelFiltros troca a URL e a página traz outra primeira página): a lista recomeça dela.
  // Estado derivado no render, sem key de remontagem: o que não depende do filtro (Drawer, digitação) fica.
  const chaveFiltros = paramsDosFiltros(filtros);
  const [filtrosVistos, setFiltrosVistos] = useState(chaveFiltros);
  if (filtrosVistos !== chaveFiltros) {
    setFiltrosVistos(chaveFiltros);
    setItens(selecionadoInicial ? zerarNaoLidas(inicial.itens, selecionadoInicial) : inicial.itens);
    setProximo(inicial.proximo);
    setContagens(contagensIniciais);
    setSelecionado(selecionadoInicial);
    setVista(selecionadoInicial ? "conversa" : "lista");
  }
  const selecionadoRef = useRef(selecionado);
  const regiaoConversa = useRef<HTMLElement>(null);
  const filtrosRef = useRef(filtros);
  const leituraRef = useRef<EstadoLeitura>({ id: null, versao: 0, fase: "nenhuma", ultimaContagem: 0 });
  const consultasRef = useRef({ iniciada: 0, aplicada: 0 });
  useEffect(() => { selecionadoRef.current = selecionado; }, [selecionado]);
  useEffect(() => {
    filtrosRef.current = filtros;
    // Invalida inclusive A→B→A: uma resposta antiga não pertence ao novo contexto da lista.
    consultasRef.current.aplicada = ++consultasRef.current.iniciada;
  }, [chaveFiltros, filtros]);
  useEffect(() => { possuiContagensRef.current = contagensIniciais !== undefined; }, [contagensIniciais]);
  const carregarLista = useCallback((filtro: FiltrosInbox) => {
    // Uma consulta iniciada antes da leitura (ou enquanto ela estava em voo) pode trazer um contador antigo.
    const inicio = { ...leituraRef.current };
    const pedido = ++consultasRef.current.iniciada;
    void buscarPagina(filtro, null).then((p) => {
      if (!p || pedido < consultasRef.current.aplicada) return;
      const leitura = leituraRef.current;
      // Após falha, só uma consulta iniciada já nessa fase pode corrigir a contagem restaurada.
      // Um GET da leitura anterior (ou da fase pendente) pode conter zero anterior à mensagem nova.
      if (leitura.fase === "falha" && (inicio.id !== leitura.id || inicio.versao !== leitura.versao || inicio.fase !== "falha")) return;
      consultasRef.current.aplicada = pedido;
      // O agregado não admite o zero otimista por linha: só um snapshot iniciado após a leitura vale.
      if (p.contagens && leitura.fase !== "pendente" && inicio.id === leitura.id
        && inicio.versao === leitura.versao && inicio.fase === leitura.fase) setContagens(p.contagens);
      const linha = leitura.id ? p.itens.find((i) => i.id === leitura.id) : null;
      const antiga = inicio.id !== leitura.id || inicio.versao !== leitura.versao || inicio.fase !== "sucesso";
      if (linha && !(leitura.fase === "sucesso" && antiga)) {
        leitura.ultimaContagem = leitura.fase === "pendente" ? Math.max(leitura.ultimaContagem, linha.naoLidas) : linha.naoLidas;
      }
      setItens((atual) => {
        const lista = mesclarPrimeiraPagina(atual, p.itens, p.proximo, selecionadoRef.current);
        const vigente = leituraRef.current;
        const antiga = inicio.id !== vigente.id || inicio.versao !== vigente.versao || inicio.fase !== "sucesso";
        return regiaoConversa.current?.getClientRects().length && vigente.id === selecionadoRef.current && (vigente.fase === "pendente" || (vigente.fase === "sucesso" && antiga))
          ? zerarNaoLidas(lista, vigente.id!) : lista;
      });
    });
  }, []);
  const marcarLeituraRef = useRef<((id: string) => void) | null>(null);
  useEffect(() => {
    marcarLeituraRef.current = criarMarcadorDeLeitura(async (id) => {
      const versao = leituraRef.current.versao;
      let sucesso = false;
      try { sucesso = (await marcarAtendimentoLido(id)).ok; } catch { /* reconcilia abaixo */ }
      const leitura = leituraRef.current;
      if (leitura.id !== id || leitura.versao !== versao) return;
      leitura.fase = sucesso ? "sucesso" : "falha";
      if (sucesso) {
        leitura.ultimaContagem = 0;
        if (possuiContagensRef.current) carregarLista(filtrosRef.current);
      } else {
        // O zero otimista deixa de valer; uma consulta nova apura o valor exato sem repetição automática.
        setItens((atual) => atual.map((i) => i.id === id ? { ...i, naoLidas: leitura.ultimaContagem } : i));
        carregarLista(filtrosRef.current);
      }
    }, (id) => selecionadoRef.current === id && document.visibilityState === "visible" && Boolean(regiaoConversa.current?.getClientRects().length));
    return () => { marcarLeituraRef.current = null; };
  }, [carregarLista]);
  const pedirLeitura = useCallback((id: string, mensagemNova = false) => {
    const anterior = leituraRef.current;
    const conhecida = anterior.id === id ? anterior.ultimaContagem : (itens.find((i) => i.id === id)?.naoLidas ?? inicial.itens.find((i) => i.id === id)?.naoLidas ?? 0);
    leituraRef.current = { id, versao: anterior.versao + 1, fase: "pendente", ultimaContagem: mensagemNova ? conhecida + 1 : conhecida };
    setItens((lista) => zerarNaoLidas(lista, id));
    marcarLeituraRef.current?.(id);
  }, [itens, inicial.itens]);
  useEffect(() => {
    if (selecionado && leituraRef.current.id !== selecionado) pedirLeitura(selecionado);
  }, [selecionado, pedirLeitura]);
  useEffect(() => {
    const pagina = document;
    const aoRetornar = () => {
      const id = selecionadoRef.current;
      if (pagina.visibilityState === "visible" && id && regiaoConversa.current?.getClientRects().length) pedirLeitura(id);
    };
    pagina.addEventListener("visibilitychange", aoRetornar);
    return () => pagina.removeEventListener("visibilitychange", aoRetornar);
  }, [pedirLeitura]);
  // Painel por setor do atendimento aberto; recarrega ao trocar de conversa e depois de uma ação.
  const [painelSetor, setPainelSetor] = useState<{ id: string; dado: DadosPainelSetor | null } | null>(null);
  const [versaoPainel, setVersaoPainel] = useState(0);
  useEffect(() => {
    if (!selecionado) return;
    let ativo = true;
    // Recarga que falha (rede, 5xx) com um painel deste atendimento já carregado mantém o último conhecido: o
    // compositor não troca o campo pelo erro no meio da digitação nem esconde uma gravação (C2 da R1 do #220).
    // O erro com "Tentar de novo" fica para a carga inicial; o servidor continua decidindo cada envio.
    // 404 numa recarga (acesso revogado, avisado pelo SSE): o último painel fica, com o compositor travado e sem ações
    // (C1 da revisão do #223). 404 na carga inicial segue como erro.
    void buscarPainel(selecionado).then((r) => {
      if (!ativo) return;
      setPainelSetor((ant) => {
        const conhecido = ant?.id === selecionado && ant.dado ? ant.dado : null;
        if (r === "sem-acesso") return { id: selecionado, dado: conhecido ? { ...conhecido, acoes: null, podeEnviar: false } : null };
        return !r && conhecido ? ant! : { id: selecionado, dado: r };
      });
    });
    return () => { ativo = false; };
  }, [selecionado, versaoPainel]);

  // Aviso do SSE: a thread se reconcilia em `useConversa` (recebe o aviso); a lista recarrega só a primeira página
  // e troca as linhas afetadas, sem refazer a página inteira.
  const recarregarLista = useCallback(() => {
    setVersaoPainel((v) => v + 1);
    carregarLista(filtros);
  }, [filtros, carregarLista]);
  // Aviso que pode mudar a permissão do atendimento aberto (`atendimento.atualizado`: transferência, responsável,
  // status) ou resync: o painel recarrega e, com ele, o podeEnviar do compositor (C3 da revisão do #218). Mensagem
  // nova ou status de mensagem não mudam permissão (C1 da R1 do #220). Sem trocar o painelSetor: o compositor não
  // pisca em "Carregando…".
  const aoAviso = useCallback((a: AvisoInbox) => {
    setEventoRecente(a);
    if (avisoMarcaLida(a, selecionadoRef.current) && regiaoConversa.current?.getClientRects().length && typeof document !== "undefined" && document.visibilityState === "visible") {
      pedirLeitura(a.atendimentoId!, true);
    }
    if (a.tipo === "resync" || (a.tipo === "atendimento.atualizado" && a.atendimentoId !== null && a.atendimentoId === selecionadoRef.current)) setVersaoPainel((v) => v + 1);
    carregarLista(filtros);
  }, [filtros, carregarLista, pedirLeitura]);
  const { conectado } = useEventosInbox(aoAviso);
  const conversa = useConversa(selecionado, eventoRecente);

  // Permissão de envio do compositor: null enquanto o painel do atendimento aberto não chegou; painel que falhou
  // (buscarPainel devolve null) vira erro com "Tentar de novo", que volta a carregar. Só true envia.
  const painelDoAberto = painelSetor && painelSetor.id === selecionado ? painelSetor : null;
  const podeEnviar = painelDoAberto?.dado ? painelDoAberto.dado.podeEnviar === true : null;
  const tentarPainelDeNovo = useCallback(() => { setPainelSetor(null); setVersaoPainel((v) => v + 1); }, []);
  const falhaPermissao = painelDoAberto && !painelDoAberto.dado ? tentarPainelDeNovo : undefined;

  const atual = useMemo(() => itens.find((i) => i.id === selecionado) ?? null, [itens, selecionado]);

  function abrir(id: string) {
    selecionadoRef.current = id;
    pedirLeitura(id);
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
    <div>
      <div className="space-y-2 p-4 text-sm">
        <p className="font-medium">{atual.contatoNome}</p>
        {atual.contatoTelefone && <p className="text-gray-600">{atual.contatoTelefone}</p>}
        <p className="text-gray-600">{atual.numeroRotulo} · {rotular(SETOR_ATENDIMENTO_LABEL, atual.finalidade)}</p>
      </div>
      {painelSetor?.id === atual.id
        ? <PainelSetor painel={painelSetor.dado} />
        : <p className="p-4 text-sm text-gray-600">Carregando detalhes…</p>}
      {painelSetor?.id === atual.id && painelSetor.dado?.aria && (
        <PainelAria key={`aria:${atual.id}`} atendimentoId={atual.id} aria={painelSetor.dado.aria} fuso={fuso} aoMudar={recarregarLista} />
      )}
      {painelSetor?.id === atual.id && painelSetor.dado?.acoes && (
        <AcoesContato key={`acoes:${atual.id}`} atendimentoId={atual.id} acoes={painelSetor.dado.acoes} optOut={atual.optOut} fuso={fuso} aoMudar={recarregarLista} />
      )}
      {!atual.grupo && (
        <OptOutContato key={atual.contatoId} contatoId={atual.contatoId} nome={atual.contatoNome} optOut={atual.optOut}
          podeReautorizar={usuario.papeis.includes("ADMINISTRADOR")} aoMudar={recarregarLista} />
      )}
    </div>
  ) : <p className="p-4 text-sm text-gray-600">Escolha uma conversa para ver os detalhes.</p>;

  return (
    <div data-vista={vista} data-conectado={conectado ? "1" : "0"} className="flex min-h-0 flex-1 overflow-hidden rounded-item border">
      <section aria-label="Conversas" className={`${vista === "lista" ? "flex" : "hidden"} w-full min-h-0 flex-col overflow-hidden border-r ${COLUNA_LISTA}`}>
        {opcoesFiltro && <div role="region" aria-label="Filtros de conversas" className="min-h-0 max-h-[50%] shrink-0 overflow-y-auto"><PainelFiltros filtros={filtros} setores={opcoesFiltro.setores} numeros={opcoesFiltro.numeros} /></div>}
        <ListaAtendimentos itens={itens} proximo={proximo} selecionado={selecionado} aoSelecionar={abrir} aoCarregarMais={() => void maisAntigas()} fuso={fuso} />
      </section>

      <section ref={regiaoConversa} aria-label="Conversa" className={`${vista === "conversa" ? "flex" : "hidden"} w-full min-h-0 min-w-0 flex-col overflow-hidden [&>header]:relative [&>header]:min-h-0 [&>header]:max-h-[40%] [&>header]:shrink-0 [&>header]:overflow-y-auto ${COLUNA_CONVERSA}`}>
        {!selecionado ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {(triagem || revisoes) && <PainelTriagem triagem={triagem} revisoes={revisoes} preferenciaFusoExibicao={fuso} />}
            <div className="p-6 text-center text-gray-600">
              <p className="font-medium">Escolha uma conversa</p>
              <p className="text-sm">As mensagens aparecem aqui.</p>
            </div>
          </div>
        ) : (
          <ConversaAberta
            item={atual}
            usuario={usuario}
            fuso={fuso}
            conversa={conversa}
            podeEnviar={podeEnviar}
            falhaPermissao={falhaPermissao}
            destinos={destinos}
            triagem={triagem}
            revisoes={revisoes}
            aoVoltar={() => setVista("lista")}
            aoAbrirPainel={() => setVista("painel")}
            aoMudar={recarregarLista}
          />
        )}
      </section>

      <aside aria-label="Detalhes" className="relative hidden w-[320px] shrink-0 overflow-y-auto border-l min-[1100px]:block">{painel}</aside>
      <div className="min-[1100px]:hidden">
        <Drawer open={vista === "painel"} onClose={() => setVista(selecionado ? "conversa" : "lista")} title="Detalhes da conversa">{painel}</Drawer>
      </div>
    </div>
  );
}
