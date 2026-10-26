"use client";
import { recontarNaoLidasInbox } from "@/components/SeloNaoLidasInbox";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Papel } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import { PopoverNovaConversa } from "./fluxos/nova-conversa/PopoverNovaConversa";
import { criarIntencaoNovaConversa } from "./fluxos/nova-conversa/intencao-nova-conversa";
import { PainelContato, abasDoPainel, type IdAbaPainel } from "./PainelContato";
import { LinhaCampo } from "./LinhaCampo";
import { TagsContato } from "./abas/TagsContato";
import { ContatoSemNome } from "./abas/ContatoSemNome";
import { AbaDetalhes } from "./abas/AbaDetalhes";
import { AbaInsights } from "./insights/AbaInsights";
import type { PortaRascunhoInsight } from "@/components/conversa/rascunho-insight";
import { ClienteVoltou } from "./abas/ClienteVoltou";
import { ModalTarefa } from "./ModalTarefa";
import {AbaAtividade} from "./abas/AbaAtividade";
import type {AtividadePainel} from "@/server/inbox/painel-atividade";
import { AbaOportunidades } from "./abas/AbaOportunidades";
import { ModalPerda } from "../funil/ModalPerda";
import { marcarPerdidoNoInbox } from "@/server/inbox/acoes-painel";
import { assumirAtendimento, assumirConversaDaAria } from "@/server/whatsapp/acoes-atendimento";
import { podeExecutar } from "@/server/inbox/permissoes";
import type { Setor } from "@/server/whatsapp/setor";
import type { OportunidadesPainel } from "@/server/inbox/painel-oportunidades";
import { GavetaContato } from "./abas/GavetaContato";
import { useAbaPainel } from "./abas/useAbaPainel";
import type { DetalhesPainel } from "@/server/inbox/painel-detalhes";
import { IconPhone, IconMessages } from "@tabler/icons-react";
import { classesDoPainel, painelEfetivo, proximoEstadoPainel, useModoInbox } from "./painel-inbox";
import { useConversa } from "@/components/conversa/useConversa";
import { SETOR_ATENDIMENTO_LABEL, rotular } from "@/lib/labels";
import type { AvisoInbox } from "@/server/inbox/barramento";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import type { ContagensChipsInbox, FiltrosInbox } from "@/server/inbox/filtros";
import type { ResumoListaInbox } from "@/server/inbox/contagens";
import type { OpcoesFiltroInbox } from "@/server/inbox/opcoes-filtro";
import type { PainelSetor as DadosPainelSetor } from "@/server/inbox/paineis";
import { marcarAtendimentoLidoAutomatico } from "@/server/whatsapp/preferencias";
import { ConversaAberta } from "./ConversaAberta";
import type { ItemTriagem, RevisaoEnvio, OpcoesAtendimento } from "@/server/whatsapp/operacoes-atendimento";
import type { DestinoTransferencia } from "./AcoesAtendimento";
import { ColunaConversas } from "./ColunaConversas";
import { FaixaAriaAtiva } from "./aria/FaixaAriaAtiva";
import { AcoesContato } from "./AcoesContato";
import { OptOutContato } from "./OptOutContato";
import { Botao } from "@/components/Botao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { EsqueletoPainel } from "@/components/Esqueleto";
import { PainelSetor } from "./PainelSetor";
import { PainelTriagem } from "./PainelTriagem";
import { usePresencaInbox } from "./usePresencaInbox";
import { useEventosInbox } from "./useEventosInbox";
import { criarMarcadorDeLeitura } from "./marcar-lida";
import { criarAtualizadorEmLote } from "./atualizar-lista-em-lote";

const useEfeitoDeLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type VistaInbox = "lista" | "conversa" | "painel";
type EstadoLeitura = { id: string | null; versao: number; fase: "nenhuma" | "pendente" | "sucesso" | "falha"; ultimaContagem: number };

export interface PropsInboxNovo {
  inicial: { itens: ItemListaInbox[]; proximo: string | null };
  filtros: FiltrosInbox;
  selecionado: string | null;
  usuario: { id: string; nome?: string; papeis: Papel[] };
  podeAbrirFunil?: boolean;
  podeCriarOportunidade?: boolean;
  fuso: string | null;
  /** Fuso institucional já consultado pela página, para fallback dos instantes. */
  fusoEscola?: string;
  /** Instante obrigatório para consumidores SSR: serializar o número capturado na página; sem ele, usa 0 até hidratar. */
  agoraInicial?: number;
  /** Destinos de transferência com contexto (FINANCEIRO/PEDAGOGICO), de `listarOpcoesAtendimento`. */
  destinos?: DestinoTransferencia[];
  /** Triagem e revisão de envio (Task 33): nulas para quem `listarTriagemWhatsApp` / `listarRevisoesEnvio` recusam. */
  triagem?: ItemTriagem[] | null;
  revisoes?: RevisaoEnvio[] | null;
  /** Setores e números dos filtros da coluna (`opcoesFiltroInbox`); sem eles a barra de filtros não aparece. */
  opcoesFiltro?: OpcoesFiltroInbox;
  /** Agregados autorizados; a apresentação em chips é entregue pela etapa 313. */
  contagens?: ContagensChipsInbox;
  /** Resumo autorizado aditivo; apresentação nas etapas345–347. */
  resumo?: ResumoListaInbox;
  abrirPainelPadrao?: boolean;
  opcoesNovaConversa?: OpcoesAtendimento;
  sino?: ReactNode;
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
  if (f.aria) q.set("aria", f.aria);
  if (cursor) q.set("cursor", cursor);
  else if (opcoes.contagens) q.set("contagens", "1");
  return q.toString();
}

type PaginaInbox = { itens: ItemListaInbox[]; proximo: string | null; contagens?: ContagensChipsInbox; resumo?:ResumoListaInbox };

async function buscarPagina(filtros: FiltrosInbox, cursor: string | null): Promise<PaginaInbox | null> {
  try {
    const r = await fetch(`/api/inbox/atendimentos?${paramsDosFiltros(filtros, cursor, { contagens: true })}`, { cache: "no-store", credentials: "same-origin" });
    if (!r.ok) { await r.arrayBuffer(); return null; }
    return await r.json() as PaginaInbox;
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

/** Invalida também os dados da Aria, sem trocar o painel conhecido durante a recarga. */
export function avisoRecarregaPainel(a: AvisoInbox, selecionado: string | null): boolean {
  return a.tipo === "resync" || a.tipo === "aria.global"
    || (a.tipo === "atendimento.atualizado"
      && a.atendimentoId !== null
      && a.atendimentoId === selecionado);
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

// Limiares locais consideram a Sidebar global e o compositor humano, sem alterar a navegação.
const COLUNA_LISTA = "min-[960px]:flex min-[960px]:w-[300px] min-[960px]:shrink-0 min-[1100px]:w-[372px]";
const COLUNA_CONVERSA = "min-[960px]:flex min-[960px]:min-w-0 min-[960px]:flex-1";

export function InboxNovo({ inicial, filtros, selecionado: selecionadoInicial, usuario, fuso, fusoEscola, destinos, triagem: triagemBruta = null, revisoes: revisoesBrutas = null, opcoesFiltro, contagens: contagensIniciais, resumo: resumoInicial, abrirPainelPadrao, opcoesNovaConversa, sino, agoraInicial, podeAbrirFunil = false, podeCriarOportunidade = false }: PropsInboxNovo) {
  const parametrosDaRota = useSearchParams();
  const router = useRouter();
  const selecionadoDaRota = parametrosDaRota === null ? selecionadoInicial : (parametrosDaRota.get("c") || null);
  const [rotaVista, setRotaVista] = useState(selecionadoDaRota);
  const triagem = ouNulo(triagemBruta);
  const revisoes = ouNulo(revisoesBrutas);
  const [itens, setItens] = useState(() => selecionadoInicial ? zerarNaoLidas(inicial.itens, selecionadoInicial) : inicial.itens);
  // Agregados do servidor, reconciliados por leitura/SSE; nunca pelo tamanho da página.
  const [contagens, setContagens] = useState(contagensIniciais);
  const [resumo, setResumo] = useState(resumoInicial);
  const [novaConversaAberta, setNovaConversaAberta] = useState(false);
  const [intencaoPorAtor, setIntencaoPorAtor] = useState(() => ({ atorId: usuario.id, controle: criarIntencaoNovaConversa() }));
  if (intencaoPorAtor.atorId !== usuario.id) setIntencaoPorAtor({ atorId: usuario.id, controle: criarIntencaoNovaConversa() });
  const intencaoNovaConversa = intencaoPorAtor.controle;
  const possuiContagensRef = useRef(contagensIniciais !== undefined || resumoInicial !== undefined);
  const [proximo, setProximo] = useState(inicial.proximo);
  const interagirPresenca = usePresencaInbox(usuario.id);
  const [avisoTransferencia, setAvisoTransferencia] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState(selecionadoInicial);
  const [selecionadoRecebido, setSelecionadoRecebido] = useState(selecionadoInicial);
  const [versaoNavegacao, setVersaoNavegacao] = useState(0);
  const [vista, setVista] = useState<VistaInbox>(selecionadoInicial ? "conversa" : "lista");
  const modo = useModoInbox();
  const [modoVisto, setModoVisto] = useState(modo);
  const [painelAberto, setPainelAberto] = useState<boolean | null>(abrirPainelPadrao ?? null);
  if (modo !== modoVisto) {
    setModoVisto(modo);
    if (modoVisto !== null && (modoVisto === "tres") !== (modo === "tres")) setPainelAberto(null);
    if (modoVisto === "uma" && modo !== "uma" && vista === "painel") { setVista("conversa"); if (modo !== "tres") setPainelAberto(true); }
    else if (modo === "uma" && vista === "painel") setVista("conversa");
  }
  const painelVisivel = modo === null ? null : painelEfetivo(painelAberto, vista, modo === "uma" ? 0 : modo === "tres" ? 1400 : 960);
  function fecharPainel() { setPainelAberto(false); if (vista === "painel") setVista("conversa"); }
  function alternarPainel() {
    const proximo = proximoEstadoPainel(painelAberto, window.innerWidth);
    setPainelAberto(proximo.aberto);
    if (proximo.vista) setVista(proximo.vista);
  }
  const [eventoRecente, setEventoRecente] = useState<AvisoInbox | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  // Filtro novo (os controles da coluna trocam a URL e a página traz outra primeira página): a lista recomeça dela.
  // Estado derivado no render, sem key de remontagem: o que não depende do filtro (Drawer, digitação) fica.
  const chaveFiltros = paramsDosFiltros(filtros);
  const [filtrosVistos, setFiltrosVistos] = useState(chaveFiltros);
  const rotaMudou = rotaVista !== selecionadoDaRota;
  if (rotaMudou) setRotaVista(selecionadoDaRota);
  if (selecionadoInicial === selecionadoDaRota && (filtrosVistos !== chaveFiltros || selecionadoRecebido !== selecionadoInicial || (rotaMudou && selecionado !== selecionadoDaRota))) {
    setSelecionadoRecebido(selecionadoInicial);
    if (filtrosVistos !== chaveFiltros || selecionado !== selecionadoInicial) {
      setVersaoNavegacao((v) => v + 1);
      setNovaConversaAberta(false);
      setFiltrosVistos(chaveFiltros);
      setItens(selecionadoInicial ? zerarNaoLidas(inicial.itens, selecionadoInicial) : inicial.itens);
      setProximo(inicial.proximo);
      setContagens(contagensIniciais);
      setResumo(resumoInicial);
      setSelecionado(selecionadoInicial);
      setVista(selecionadoInicial ? "conversa" : "lista");
    } else {
      // Revalidação confirma a seleção local: atualiza a primeira página sem perder as já carregadas.
      setItens((atualLista) => mesclarPrimeiraPagina(atualLista, inicial.itens, inicial.proximo, selecionado));
      if (itens.length <= inicial.itens.length || !inicial.proximo) setProximo(inicial.proximo);
      setContagens(contagensIniciais);
      setResumo(resumoInicial);
    }
  }
  const selecionadoRef = useRef(selecionado);
  const regiaoConversa = useRef<HTMLElement>(null);
  const regiaoLista = useRef<HTMLElement>(null);
  const focoAoFecharPopover = useRef<HTMLElement | null>(null);
  const navegacaoVista = useRef(versaoNavegacao);
  // O layout ocorre antes do cleanup passivo do diálogo: não retorna ao gatilho na lista oculta.
  useEfeitoDeLayout(() => {
    if (navegacaoVista.current === versaoNavegacao) return;
    navegacaoVista.current = versaoNavegacao;
    focoAoFecharPopover.current = selecionadoInicial && regiaoConversa.current?.getClientRects().length
      ? regiaoConversa.current
      : regiaoLista.current?.querySelector<HTMLInputElement>('input[type="search"]') ?? null;
  }, [versaoNavegacao, selecionadoInicial]);
  const entradasPendentesRef = useRef<{ id: string; mensagens: Set<string | null> } | null>(null);
  const versaoEntradasRef = useRef(0);
  const filtrosRef = useRef(filtros);
  const leituraRef = useRef<EstadoLeitura>({ id: null, versao: 0, fase: "nenhuma", ultimaContagem: 0 });
  const consultasRef = useRef({ iniciada: 0, aplicada: 0 });
  const atualizadorListaRef = useRef<ReturnType<typeof criarAtualizadorEmLote> | null>(null);
  const navegacaoDaListaRef = useRef(versaoNavegacao);
  useEffect(() => { selecionadoRef.current = selecionado; }, [selecionado]);
  useEffect(() => {
    // Um objeto SSR equivalente não elimina a reconciliação pessoal pendente.
    if (paramsDosFiltros(filtrosRef.current) !== chaveFiltros || navegacaoDaListaRef.current !== versaoNavegacao) atualizadorListaRef.current?.cancelarPendentes();
    else atualizadorListaRef.current?.invalidarSnapshotEmVoo();
    navegacaoDaListaRef.current = versaoNavegacao;
    filtrosRef.current = filtros;
    // Invalida inclusive A→B→A: uma resposta antiga não pertence ao novo contexto da lista.
    consultasRef.current.aplicada = ++consultasRef.current.iniciada;
  }, [chaveFiltros, filtros, selecionadoInicial, versaoNavegacao]);
  useEffect(() => { possuiContagensRef.current = contagensIniciais !== undefined || resumoInicial !== undefined; }, [contagensIniciais, resumoInicial]);
  const executarAtualizacao = useCallback(async (contextoVigente: () => boolean) => {
    const filtro = filtrosRef.current;
    // Uma consulta iniciada antes da leitura (ou enquanto ela estava em voo) pode trazer um contador antigo.
    const inicio = { ...leituraRef.current };
    const entradasNoInicio = versaoEntradasRef.current;
    const pagina = typeof document === "undefined" ? null : document;
    const pedido = ++consultasRef.current.iniciada;
    const p = await buscarPagina(filtro, null);
    if (!contextoVigente() || !p || pedido < consultasRef.current.aplicada) return;
    const leitura = leituraRef.current;
    const mesmaLeitura = inicio.id === leitura.id && inicio.versao === leitura.versao;
    // Uma consulta de outra leitura não pode apagar a restauração após falha.
    // Na mesma versão, a resposta continua válida mesmo se a ação falhar enquanto o GET está em voo.
    if (leitura.fase === "falha" && !mesmaLeitura) return;
    consultasRef.current.aplicada = pedido;
    // O agregado não admite o zero otimista por linha: só um snapshot iniciado após a leitura vale.
    if (leitura.fase !== "pendente" && inicio.id === leitura.id
      && inicio.versao === leitura.versao && inicio.fase === leitura.fase) {
      if (p.contagens) setContagens(p.contagens);
      if (p.resumo) setResumo(p.resumo);
    }
    const linha = leitura.id ? p.itens.find((i) => i.id === leitura.id) : null;
    const antiga = inicio.id !== leitura.id || inicio.versao !== leitura.versao || inicio.fase !== "sucesso";
    if (linha && !(leitura.fase === "sucesso" && antiga)) {
      const entrouDepois = entradasNoInicio !== versaoEntradasRef.current;
      // O GET fresco é autoritativo inclusive em zero (outra aba pode ter lido).
      // IDs ocultos governam a próxima tentativa, sem impor um mínimo ao contador.
      leitura.ultimaContagem = mesmaLeitura && !entrouDepois
        ? linha.naoLidas
        : Math.max(leitura.ultimaContagem, linha.naoLidas);
    }
    setItens((atual) => {
      const lista = mesclarPrimeiraPagina(atual, p.itens, p.proximo, selecionadoRef.current);
      const vigente = leituraRef.current;
      const antiga = inicio.id !== vigente.id || inicio.versao !== vigente.versao || inicio.fase !== "sucesso";
      if (vigente.id === selecionadoRef.current && (entradasPendentesRef.current?.id === vigente.id || vigente.fase === "pendente" || (vigente.fase === "sucesso" && antiga))) {
        const otimista = vigente.fase === "pendente" && pagina?.visibilityState === "visible" && regiaoConversa.current?.getClientRects().length;
        return lista.map((i) => i.id === vigente.id ? { ...i, naoLidas: otimista ? 0 : vigente.ultimaContagem } : i);
      }
      return lista;
    });
  }, []);
  useEffect(() => {
    const atualizador = criarAtualizadorEmLote(executarAtualizacao);
    atualizadorListaRef.current = atualizador;
    return () => { atualizador.descartar(); atualizadorListaRef.current = null; };
  }, [executarAtualizacao]);
  const carregarLista = useCallback(() => { atualizadorListaRef.current?.solicitar(); }, []);
  const marcarLeituraRef = useRef<((id: string) => void) | null>(null);
  useEffect(() => {
    marcarLeituraRef.current = criarMarcadorDeLeitura(async (id) => {
      const versao = leituraRef.current.versao;
      const entradasNoPedido = entradasPendentesRef.current?.id === id ? new Set(entradasPendentesRef.current.mensagens) : null;
      let sucesso = false;
      try { sucesso = (await marcarAtendimentoLidoAutomatico(id)).ok; } catch { /* reconcilia abaixo */ } finally { recontarNaoLidasInbox(); }
      const entradasAtuais = entradasPendentesRef.current;
      if (sucesso && entradasNoPedido && entradasAtuais?.id === id) {
        for (const mensagemId of entradasNoPedido) entradasAtuais.mensagens.delete(mensagemId);
        if (entradasAtuais.mensagens.size === 0) entradasPendentesRef.current = null;
      }
      const leitura = leituraRef.current;
      if (leitura.id !== id || leitura.versao !== versao) return;
      leitura.fase = sucesso ? "sucesso" : "falha";
      if (sucesso) {
        const restantes = entradasPendentesRef.current?.id === id ? entradasPendentesRef.current.mensagens.size : 0;
        leitura.ultimaContagem = Math.min(leitura.ultimaContagem, restantes);
        setItens((atual) => atual.map((i) => i.id === id ? { ...i, naoLidas: leitura.ultimaContagem } : i));
        if (possuiContagensRef.current) carregarLista();
      } else {
        // O zero otimista deixa de valer; uma consulta nova apura o valor exato sem repetição automática.
        setItens((atual) => atual.map((i) => i.id === id ? { ...i, naoLidas: leitura.ultimaContagem } : i));
        carregarLista();
      }
    }, (id) => selecionadoRef.current === id && document.visibilityState === "visible" && Boolean(regiaoConversa.current?.getClientRects().length));
    return () => { marcarLeituraRef.current = null; };
  }, [carregarLista]);
  const pedirLeitura = useCallback((id: string, mensagemNova = false) => {
    const anterior = leituraRef.current;
    const contagem = anterior.id === id ? anterior.ultimaContagem : (itens.find((i) => i.id === id)?.naoLidas ?? inicial.itens.find((i) => i.id === id)?.naoLidas ?? 0);
    leituraRef.current = { id, versao: anterior.versao + 1, fase: "pendente", ultimaContagem: mensagemNova ? contagem + 1 : contagem };
    setItens((lista) => zerarNaoLidas(lista, id));
    marcarLeituraRef.current?.(id);
  }, [itens, inicial.itens]);
  useEffect(() => {
    if (selecionado && leituraRef.current.id !== selecionado) pedirLeitura(selecionado);
    else if (!selecionado && leituraRef.current.id !== null) {
      leituraRef.current = { id: null, versao: leituraRef.current.versao + 1, fase: "nenhuma", ultimaContagem: 0 };
    }
  }, [selecionado, pedirLeitura]);
  useEffect(() => {
    const pagina = document;
    const aoRetornar = () => {
      const id = selecionadoRef.current;
      const leitura = leituraRef.current;
      const precisaLer = id && (entradasPendentesRef.current?.id === id || (leitura.id === id && leitura.ultimaContagem > 0));
      if (pagina.visibilityState === "visible" && precisaLer && regiaoConversa.current?.getClientRects().length) pedirLeitura(id);
    };
    pagina.addEventListener("visibilitychange", aoRetornar);
    return () => pagina.removeEventListener("visibilitychange", aoRetornar);
  }, [pedirLeitura]);
  // Painel por setor do atendimento aberto; recarrega ao trocar de conversa e depois de uma ação.
  const [painelSetor, setPainelSetor] = useState<{ id: string; dado: DadosPainelSetor | null; acessoRevogado: boolean; leitura: { versao: number; resultado: "ok" | "falha" | "sem-acesso" } } | null>(null);
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
        const leitura: { versao: number; resultado: "ok" | "falha" | "sem-acesso" } = { versao: versaoPainel, resultado: r === "sem-acesso" ? "sem-acesso" : r ? "ok" : "falha" };
        if (r === "sem-acesso") return { id: selecionado, leitura, acessoRevogado: true, dado: conhecido ? { ...conhecido, acoes: null, podeEnviar: false, aria: conhecido.aria ? { ...conhecido.aria, podeDevolver: false, podeDecidir: false, podeAssumirAria: false, handoff: conhecido.aria.handoff ? { ...conhecido.aria.handoff, podeAssumir: false, ehResponsavel: false } : conhecido.aria.handoff } : null } : null };
        return !r && conhecido ? { ...ant!, leitura } : { id: selecionado, dado: r, leitura, acessoRevogado: !r && ant?.id === selecionado && ant.acessoRevogado === true };
      });
    });
    return () => { ativo = false; };
  }, [selecionado, versaoPainel]);

  // Aviso do SSE: a thread se reconcilia em `useConversa` (recebe o aviso); a lista recarrega só a primeira página
  // e troca as linhas afetadas, sem refazer a página inteira.
  const recarregarLista = useCallback(() => {
    setVersaoPainel((v) => v + 1);
    carregarLista();
  }, [carregarLista]);
  // Aviso que pode mudar a permissão do atendimento aberto (`atendimento.atualizado`: transferência, responsável,
  // status) ou resync: o painel recarrega e, com ele, o podeEnviar do compositor (C3 da revisão do #218). Mensagem
  // nova ou status de mensagem não mudam permissão (C1 da R1 do #220). Sem trocar o painelSetor: o compositor não
  // pisca em "Carregando…".
  const aoAviso = useCallback((a: AvisoInbox) => {
    // React pode agrupar mensagem+global: preservar o aviso que reconcilia a thread.
    if (a.tipo !== "aria.global") setEventoRecente(a);
    if (avisoMarcaLida(a, selecionadoRef.current)) {
      const repetida = entradasPendentesRef.current?.id === a.atendimentoId && entradasPendentesRef.current.mensagens.has(a.mensagemId);
      if (!repetida) versaoEntradasRef.current++;
      // Também registra a entrada visível: sua leitura pode ficar enfileirada e ser
      // suspensa ao ocultar a aba antes de a ação anterior terminar.
      if (entradasPendentesRef.current?.id === a.atendimentoId) entradasPendentesRef.current.mensagens.add(a.mensagemId);
      else entradasPendentesRef.current = { id: a.atendimentoId!, mensagens: new Set([a.mensagemId]) };
      if (regiaoConversa.current?.getClientRects().length && typeof document !== "undefined" && document.visibilityState === "visible") pedirLeitura(a.atendimentoId!, !repetida);
      else if (!repetida && leituraRef.current.id === a.atendimentoId) leituraRef.current.ultimaContagem++;
    }
    if (avisoRecarregaPainel(a, selecionadoRef.current)) setVersaoPainel((v) => v + 1);
    carregarLista();
  }, [carregarLista, pedirLeitura]);
  const { conectado } = useEventosInbox(aoAviso);
  const conversa = useConversa(selecionado, eventoRecente);

  // Permissão de envio do compositor: null enquanto o painel do atendimento aberto não chegou; painel que falhou
  // (buscarPainel devolve null) vira erro com "Tentar de novo", que volta a carregar. Só true envia.
  const painelDoAberto = painelSetor && painelSetor.id === selecionado ? painelSetor : null;
  const podeEnviar = painelDoAberto?.dado ? painelDoAberto.dado.podeEnviar === true : null;
  const tentarPainelDeNovo = useCallback(() => { setPainelSetor((ant) => ant?.acessoRevogado ? ant : null); setVersaoPainel((v) => v + 1); }, []);
  const falhaPermissao = painelDoAberto && !painelDoAberto.dado ? tentarPainelDeNovo : undefined;

  const atual = useMemo(() => itens.find((i) => i.id === selecionado) ?? null, [itens, selecionado]);
  const [abaDoContato, setAbaDoContato] = useState<{ atendimentoId: string | null; id: IdAbaPainel }>({ atendimentoId: selecionado, id: "detalhes" });
  // Ajuste condicionado à seleção, sem remontar a casca ou esperar um efeito após o paint.
  if (abaDoContato.atendimentoId !== selecionado) setAbaDoContato({ atendimentoId: selecionado, id: "detalhes" });
  const [edicaoContato, setEdicaoContato] = useState({ atendimentoId: selecionado, aberta: false });
  if (edicaoContato.atendimentoId !== selecionado) setEdicaoContato({ atendimentoId: selecionado, aberta: false });
  const podeEditarContato = atual?.finalidade === "COMERCIAL" && painelDoAberto?.dado?.acoes != null && !!painelDoAberto.dado.cabecalho?.pessoaId && painelDoAberto.dado.cabecalho.capacidades.editarContato;
  const editorAberto = !!selecionado && podeEditarContato && edicaoContato.atendimentoId === selecionado && edicaoContato.aberta;
  const podeUsarInsights = atual?.finalidade === "COMERCIAL" && !atual.grupo && painelDoAberto?.acessoRevogado !== true && painelDoAberto?.dado?.cabecalho?.capacidades.veLead === true;
  const abas = abasDoPainel(atual?.finalidade ?? "", { atividade: painelDoAberto?.dado?.cabecalho?.contadorAtividade }).filter(a=>a.id!=="insights"||podeUsarInsights);
  const abaAtiva = abaDoContato.atendimentoId === selecionado && abas.some(a => a.id === abaDoContato.id) ? abaDoContato.id : "detalhes";
  const detalhesComerciais = atual?.finalidade === "COMERCIAL" && !atual.grupo;
  // A aba Detalhes e o editor compartilham uma única aquisição por contexto.
  const detalhesDoContato = useAbaPainel<DetalhesPainel>(selecionado, "detalhes", versaoPainel, (detalhesComerciais && abaAtiva === "detalhes") || editorAberto);
  const oportunidadesDoContato = useAbaPainel<OportunidadesPainel>(selecionado, "oportunidades", versaoPainel, detalhesComerciais && abaAtiva === "oportunidades");
  const atividadeDoContato=useAbaPainel<AtividadePainel>(selecionado,"atividade",versaoPainel,abaAtiva==="atividade");
  const [portaRascunhoInsight,setPortaRascunhoInsight]=useState<PortaRascunhoInsight|null>(null);
  const publicarPortaRascunhoInsight=useCallback((porta:PortaRascunhoInsight|null)=>setPortaRascunhoInsight(porta),[]);
  const [perdaOportunidade, setPerdaOportunidade] = useState<{ atendimentoId: string | null; id: string | null; nome: string; aberta: boolean; sessao: number }>({ atendimentoId: selecionado, id: null, nome: "", aberta: false, sessao: 0 });
  // Loading conserva o rascunho; uma identidade conhecida diferente encerra a sessao.
  // Nao basta ocultar o modal: o proximo loading nao pode ressuscitar a oportunidade antiga.
  if (perdaOportunidade.atendimentoId !== selecionado || (perdaOportunidade.aberta && oportunidadesDoContato.dado !== null
    && oportunidadesDoContato.dado.atual?.id !== perdaOportunidade.id)) {
    setPerdaOportunidade(p => ({ ...p, atendimentoId: selecionado, id: null, nome: "", aberta: false }));
  }
  const podeMudarEtapa = detalhesComerciais && painelDoAberto?.dado?.acoes != null && painelDoAberto.dado.cabecalho?.capacidades.moverEtapa === true;
  const podeAssumir = !!atual && !atual.grupo && atual.status !== "ENCERRADO" && podeExecutar(usuario, "assumir", {
    setor: atual.finalidade as Setor, responsavelId: atual.responsavelId, linhaComercial: atual.linhaComercial, donoLinhaId: atual.numeroDonoId,
  });
  const contextoAriaParaAssumir = !!atual && !atual.grupo && atual.status !== "ENCERRADO"
    && (["ia", "aprovacao", "handoff"].includes(atual.estadoAria ?? "") || !!painelDoAberto?.dado?.aria?.handoff);
  const podeAssumirDaAria = contextoAriaParaAssumir && painelDoAberto?.dado?.aria?.podeAssumirAria === true && !painelDoAberto.acessoRevogado;
  const chaveAssumirAria = JSON.stringify([selecionado, atual?.id, atual?.responsavelId, usuario.id, usuario.papeis, contextoAriaParaAssumir, podeAssumirDaAria]);
  const [ofertaAssumirAria, setOfertaAssumirAria] = useState(() => ({ chave: chaveAssumirAria, token: Symbol("assumir-aria") }));
  if (ofertaAssumirAria.chave !== chaveAssumirAria) setOfertaAssumirAria({ chave: chaveAssumirAria, token: Symbol("assumir-aria") });
  const cicloAssumirAria = useRef({ ativo: false, token: ofertaAssumirAria.token });
  useEffect(() => {
    const atual = { ativo: podeAssumirDaAria, token: ofertaAssumirAria.token };
    cicloAssumirAria.current = atual; return () => { atual.ativo = false; };
  }, [ofertaAssumirAria.token, podeAssumirDaAria]);
  async function assumirAriaPelaAba(id: string, token: symbol) {
    const ciclo = cicloAssumirAria.current;
    if (!ciclo.ativo || ciclo.token !== token || selecionadoRef.current !== id) return { ok: false as const, erro: "A conversa ou sua permissão mudou. Atualize antes de assumir." };
    return assumirConversaDaAria(id);
  }
  const perdaAberta = !!(podeMudarEtapa && perdaOportunidade.aberta && perdaOportunidade.atendimentoId === selecionado && perdaOportunidade.id
    && (!oportunidadesDoContato.dado || oportunidadesDoContato.dado.atual?.id === perdaOportunidade.id));
  const [modalTarefa,setModalTarefa]=useState<{atendimentoId:string;modo:{tipo:"nova"}|{tipo:"editar";tarefa:{id:string;versao:number}};sessao:number;origem:"fio"|"painel"}|null>(null);
  const sessaoTarefa=useRef(0);
  const [aberturaTarefa,setAberturaTarefa]=useState(0);
  const atendimentoIndividual=!!atual&&!atual.grupo;
  const [notaSolicitada,setNotaSolicitada]=useState<{id:string;pedido:number}|null>(null);
  const sequenciaNota=useRef(0);
  if(notaSolicitada&&notaSolicitada.id!==selecionado)setNotaSolicitada(null);
  const podeTarefas=atendimentoIndividual&&painelDoAberto?.dado?.acoes!=null&&painelDoAberto.dado.cabecalho?.capacidades.tarefas===true;
  const permissaoTarefasConhecida=painelDoAberto?.dado?painelDoAberto.dado.acoes!=null&&painelDoAberto.dado.cabecalho?.capacidades.tarefas===true:null;
  if(modalTarefa&&(modalTarefa.atendimentoId!==selecionado||!atendimentoIndividual||permissaoTarefasConhecida===false))setModalTarefa(null);
  const tarefaAberta=!!modalTarefa&&modalTarefa.atendimentoId===selecionado&&atendimentoIndividual&&permissaoTarefasConhecida!==false;
  function abrirTarefa(modo:{tipo:"nova"}|{tipo:"editar";tarefa:{id:string;versao:number}},origem:"fio"|"painel"="painel"){
    if(!selecionado||!podeTarefas)return;
    setEdicaoContato({atendimentoId:selecionado,aberta:false});setPerdaOportunidade(p=>({...p,aberta:false}));
    setAberturaTarefa(n=>n+1);
    setModalTarefa({atendimentoId:selecionado,modo,sessao:++sessaoTarefa.current,origem});
  }
  const idTarefaDoModal=modalTarefa?.modo.tipo==="editar"?modalTarefa.modo.tarefa.id:null;
  const tarefasDoModal=modalTarefa?.origem==="fio"?painelDoAberto?.dado?.tarefasNoFio:oportunidadesDoContato.dado?.tarefas;
  const tarefaAtualDoModal=idTarefaDoModal?tarefasDoModal?.find(t=>t.id===idTarefaDoModal):undefined;
  function adicionarNota(){
    if(!selecionado||!atendimentoIndividual)return;
    setModalTarefa(null);setEdicaoContato({atendimentoId:selecionado,aberta:false});setPerdaOportunidade(p=>({...p,aberta:false}));
    setNotaSolicitada({id:selecionado,pedido:++sequenciaNota.current});fecharPainel();setVista("conversa");
  }
  const dialogoAberto = editorAberto || perdaAberta || tarefaAberta;
  function abrirPerda() {
    setModalTarefa(null);
    const o = oportunidadesDoContato.dado?.atual;
    if (!selecionado || !podeMudarEtapa || !o) return;
    setEdicaoContato({ atendimentoId: selecionado, aberta: false });
    setPerdaOportunidade(p => ({ atendimentoId: selecionado, id: o.id, nome: o.produto ?? o.titulo, aberta: true, sessao: p.sessao + 1 }));
  }
  const dialogoAnterior = useRef({ id: selecionado, aberta: dialogoAberto });
  useEffect(() => {
    const antes = dialogoAnterior.current;
    dialogoAnterior.current = { id: selecionado, aberta: dialogoAberto };
    if (!antes.aberta || dialogoAberto || antes.id !== selecionado) return;
    // Drawer devolve ao gatilho original; após resize ele pode estar oculto/inert.
    const disponivel = (el: HTMLElement | null): el is HTMLElement => !!el && !el.closest("[inert]") && el.getClientRects().length > 0;
    const ativo = document.activeElement as HTMLElement | null;
    if (ativo && ativo !== document.body && disponivel(ativo)) return;
    const lapis = [...document.querySelectorAll<HTMLButtonElement>('button[aria-label="Editar contato"]')].find(disponivel);
    const gatilho = [...document.querySelectorAll<HTMLButtonElement>('button[aria-controls="painel-contato"]')].find(disponivel);
    (lapis ?? gatilho ?? (disponivel(regiaoConversa.current) ? regiaoConversa.current : null))?.focus();
  }, [dialogoAberto, selecionado]);


  function abrir(id: string) {
    // ACK novo pode estar fora da página (sem mensagem, NULLS LAST). A rota carrega o item autorizado.
    if (!itens.some(item => item.id === id)) {
      if (selecionadoRef.current !== selecionado) return;
      setNovaConversaAberta(false);
      const parametros = new URLSearchParams(parametrosDaRota?.toString() ?? paramsDosFiltros(filtros).toString());
      parametros.set("c", id);
      router.push("/inbox?" + parametros.toString(), { scroll: false });
      return;
    }
    focoAoFecharPopover.current = regiaoConversa.current;
    setNovaConversaAberta(false);
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

  function falhaDosDetalhes(recarregar: () => void, aba: "detalhes" | "oportunidades" | "atividade" = "detalhes") {
    return <div role="alert" className="space-y-2 text-sm text-red-700">
      <p>{aba === "detalhes" ? "Não foi possível carregar os detalhes." : aba === "atividade" ? "Não foi possível carregar a atividade." : "Não foi possível carregar as oportunidades."}</p>
      <Botao variante="secundario" tamanho="sm" onClick={(e) => {
        e.currentTarget.closest<HTMLElement>('[id="painel-contato"]')?.focus({ preventScroll: true });
        recarregar();
      }}>Tentar de novo</Botao>
    </div>;
  }

  // Os blocos antigos preservam suas ações; só a composição local retira padding/borda duplicados.
  const secaoDetalhes = "-mx-[18px] px-[18px] empty:hidden [&>section]:border-t-0 [&>section]:p-0";
  const painel = atual ? (
    <div className="flex flex-col gap-5 [&>div+div]:border-t [&>div+div]:border-gray-200 [&>div+div]:pt-5">
      {(!detalhesComerciais || detalhesDoContato.dado?.pessoa === null) && atual.contatoTelefone && <div className={secaoDetalhes}><LinhaCampo icone={<IconPhone size={18} />} valor={<span className="font-mono">{atual.contatoTelefone}</span>} rotulo="WhatsApp" /></div>}
      <div className={secaoDetalhes}>{painelSetor?.id === atual.id && painelSetor.dado
        ? abaAtiva === "insights"
          ? <AbaInsights atendimentoId={atual.id} ativo versao={versaoPainel} fuso={fuso} fusoEscola={fusoEscola??""} rascunhoPorta={portaRascunhoInsight}/>
          : abaAtiva === "atividade"
          ? atividadeDoContato.erro ? falhaDosDetalhes(atividadeDoContato.recarregar,"atividade")
            : atividadeDoContato.dado ? <AbaAtividade dados={atividadeDoContato.dado} atendimentoId={atual.id} fuso={fuso} fusoEscola={fusoEscola??""} aoMudar={recarregarLista}/>
              : <EsqueletoPainel rotulo="atividade"/>
          : detalhesComerciais
          ? abaAtiva === "oportunidades"
            ? oportunidadesDoContato.erro ? falhaDosDetalhes(oportunidadesDoContato.recarregar, "oportunidades")
              : oportunidadesDoContato.dado ? <AbaOportunidades dados={oportunidadesDoContato.dado} capacidades={painelSetor.dado.cabecalho?.capacidades ?? { veLead: false, verContato: false, editarContato: false, editarTags: false, criarTag: false, moverEtapa: false, tarefas: false, tarefasEquipe: false, desfazerAria: false, verEmpresa: false }} atendimentoId={atual.id} fuso={fuso} fusoEscola={fusoEscola} aoMudar={recarregarLista} aoAbrirPerda={abrirPerda} aoAdicionarNota={atendimentoIndividual?adicionarNota:undefined} aoNovaTarefa={podeTarefas?()=>abrirTarefa({tipo:"nova"}):undefined} aoEditarTarefa={podeTarefas?t=>abrirTarefa({tipo:"editar",tarefa:{id:t.id,versao:t.versao}}):undefined} podeAbrirFunil={podeAbrirFunil} podeCriarOportunidade={podeCriarOportunidade} contextoAria={contextoAriaParaAssumir} podeAssumir={contextoAriaParaAssumir ? podeAssumirDaAria : podeAssumir} aoAssumir={() => contextoAriaParaAssumir ? assumirAriaPelaAba(atual.id, ofertaAssumirAria.token) : assumirAtendimento(atual.id)} />
                : <EsqueletoPainel rotulo="oportunidades" />
            : detalhesDoContato.erro ? falhaDosDetalhes(detalhesDoContato.recarregar)
              : detalhesDoContato.dado ? <AbaDetalhes dados={detalhesDoContato.dado} capacidades={painelSetor.dado.cabecalho?.capacidades ?? { verContato: false, verEmpresa: false }} aoAbrirOportunidades={() => setAbaDoContato({ atendimentoId: selecionado, id: "oportunidades" })} />
                : <EsqueletoPainel rotulo="detalhes" />
          : <PainelSetor painel={painelSetor.dado} />
        : painelSetor?.id === atual.id ? falhaDosDetalhes(tentarPainelDeNovo)
          : <EsqueletoPainel rotulo="detalhes" />}</div>
      {painelSetor?.id === atual.id && painelSetor.dado?.acoes && <div className={secaoDetalhes}>
        <AcoesContato key={`acoes:${atual.id}`} atendimentoId={atual.id} acoes={painelSetor.dado.acoes} optOut={atual.optOut} fuso={fuso} aoMudar={recarregarLista} />
      </div>}
      {!atual.grupo && <div className={secaoDetalhes}>
        <OptOutContato key={atual.contatoId} contatoId={atual.contatoId} nome={atual.contatoNome} optOut={atual.optOut}
          podeReautorizar={usuario.papeis.includes("ADMINISTRADOR")} aoMudar={recarregarLista} />
      </div>}
      {(triagem || revisoes) && <div className={secaoDetalhes}><PainelTriagem triagem={triagem} revisoes={revisoes} preferenciaFusoExibicao={fuso} /></div>}
    </div>
  ) : <p className="text-sm text-gray-600">Escolha uma conversa para ver os detalhes.</p>;

  return (
    <div onPointerDownCapture={interagirPresenca} onKeyDownCapture={interagirPresenca} onTouchStartCapture={interagirPresenca} onWheelCapture={interagirPresenca} data-vista={vista} data-conectado={conectado ? "1" : "0"} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <MensagemStatus texto={avisoTransferencia} tom="sucesso" className="shrink-0 px-3 py-2" />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <section ref={regiaoLista} aria-label="Conversas" className={`${vista === "lista" ? "flex" : "hidden"} w-full min-h-0 flex-col overflow-hidden border-gray-200 bg-surface min-[960px]:border-r ${COLUNA_LISTA}`}>
        <ColunaConversas filtros={filtros} opcoesFiltro={opcoesFiltro} contagens={contagens} resumo={resumo} sino={sino}
          faixaAria={resumo ? <FaixaAriaAtiva situacao={resumo.aria} contagens={resumo.contagens} aoMudar={recarregarLista} /> : undefined}
          itens={itens} proximo={proximo} selecionado={selecionado} aoSelecionar={abrir} aoCarregarMais={() => void maisAntigas()}
          fuso={fuso} usuarioId={usuario.id} agoraInicial={agoraInicial} podeGerenciarNumeros={usuario.papeis.includes("ADMINISTRADOR")}
          focoAoFecharPopover={focoAoFecharPopover} aoNovaConversa={() => setNovaConversaAberta(true)} novaConversaAberta={novaConversaAberta} aoFecharNovaConversa={() => setNovaConversaAberta(false)}
          novaConversa={opcoesNovaConversa ? <PopoverNovaConversa key={selecionado ?? "lista"} opcoes={opcoesNovaConversa} itens={itens} usuario={usuario} intencao={intencaoNovaConversa} aoSelecionar={abrir} aoFechar={() => setNovaConversaAberta(false)} /> : undefined} />
      </section>

      <section ref={regiaoConversa} tabIndex={-1} aria-label="Conversa" className={`${vista === "conversa" ? "flex" : "hidden"} w-full min-h-0 min-w-0 flex-col overflow-hidden fundo-conversa relative [&>header]:relative [&>header]:min-h-0 [&>header]:max-h-[40%] [&>header]:shrink-0 [&>header]:overflow-y-auto ${COLUNA_CONVERSA}`}>
        {!selecionado ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
            {(triagem || revisoes) && <PainelTriagem triagem={triagem} revisoes={revisoes} preferenciaFusoExibicao={fuso} />}
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <IconMessages size={40} className="shrink-0 text-gray-400" aria-hidden />
              <p className="text-[15px] font-semibold text-gray-800">Escolha uma conversa</p>
              <p className="text-[13px] text-gray-600">As mensagens aparecem aqui.</p>
            </div>
          </div>
        ) : (
          <ConversaAberta
            item={atual}
            tarefasNoFio={painelDoAberto?.acessoRevogado?undefined:painelDoAberto?.dado?.tarefasNoFio}
            aoCriarTarefa={podeTarefas?()=>abrirTarefa({tipo:"nova"},"fio"):undefined}
            aoEditarTarefa={podeTarefas?t=>abrirTarefa({tipo:"editar",tarefa:{id:t.id,versao:t.versao}},"fio"):undefined}
            pedidoNota={notaSolicitada?.id===selecionado?notaSolicitada.pedido:undefined}
            aoPortaRascunhoInsight={publicarPortaRascunhoInsight}
            versaoInsights={versaoPainel}
            podeUsarInsights={podeUsarInsights}
            tarefaEmEdicaoId={tarefaAberta&&modalTarefa?.origem==="fio"?idTarefaDoModal??undefined:undefined}
            aria={painelDoAberto?.dado?.aria}
            bloquearDecisoesAria={painelDoAberto?.acessoRevogado === true}
            leituraPainel={{ solicitada: versaoPainel, finalizada: painelDoAberto?.leitura.versao ?? -1, resultado: painelDoAberto?.leitura.resultado ?? "pendente" }}
            usuario={usuario}
            fuso={fuso}
            agoraInicial={agoraInicial}
            conversa={conversa}
            podeEnviar={podeEnviar}
            falhaPermissao={falhaPermissao}
            destinos={destinos}
            aoVoltar={() => setVista("lista")}
            aoAlternarPainel={alternarPainel}
            painelAberto={painelVisivel ?? undefined}
            painelAuto={painelAberto === null}
            aoMudar={recarregarLista}
            aoTransferirConcluido={() => setAvisoTransferencia("Transferência concluída.")}
          />
        )}
      </section>

      {selecionado && <PainelContato aoEditar={podeEditarContato ? () => { setModalTarefa(null); setPerdaOportunidade(p => ({ ...p, aberta: false })); setEdicaoContato({ atendimentoId: selecionado, aberta: true }); } : undefined} contato={atual ? { id: atual.contatoId, nome: atual.contatoNome,
        subtitulo: detalhesComerciais ? painelDoAberto?.dado?.cabecalho?.subtitulo ?? "" : rotular(SETOR_ATENDIMENTO_LABEL, atual.finalidade) + " · " + atual.numeroRotulo,
        tags: painelDoAberto?.dado?.tags ?? [], quadrado: detalhesComerciais && painelDoAberto?.dado?.cabecalho?.quadrado === true } : undefined}
        slotTags={painelDoAberto?.dado?.cabecalho?.pessoaId ? <TagsContato atendimentoId={selecionado} tags={painelDoAberto.dado.tags ?? []} disponiveis={painelDoAberto.dado.cabecalho.tagsDisponiveis}
          podeEditar={painelDoAberto.dado.acoes != null && painelDoAberto.dado.cabecalho.capacidades.editarTags} podeCriar={painelDoAberto.dado.acoes != null && painelDoAberto.dado.cabecalho.capacidades.criarTag} aoMudar={recarregarLista} /> : undefined}
        slotAviso={painelDoAberto?.dado?.cabecalho?.semNome || painelDoAberto?.dado?.cabecalho?.clienteVoltou ? <>
          {painelDoAberto?.dado?.cabecalho?.clienteVoltou && atual?.finalidade === "COMERCIAL" && <ClienteVoltou atendimentoId={selecionado} nome={atual.contatoNome} pessoaId={painelDoAberto.dado.cabecalho.pessoaId} dado={painelDoAberto.dado.cabecalho.clienteVoltou} podeCriar={podeCriarOportunidade && !!painelDoAberto.dado.cabecalho.pessoaId} aoMudar={recarregarLista} />}
          {painelDoAberto?.dado?.cabecalho?.semNome ? <ContatoSemNome atendimentoId={selecionado} nomeAnterior={painelDoAberto.dado.acoes?.nomeSalvo ?? null}
          podeEditar={painelDoAberto.dado.acoes?.podeEditarNome === true} aoMudar={recarregarLista} /> : null}</> : undefined}
        abas={abas} abaAtiva={abaAtiva} aoTrocarAba={id => { if (abas.some(a => a.id === id)) setAbaDoContato({ atendimentoId: selecionado, id }); }} visivel={painelVisivel} sobreposto={painelVisivel === true && modo !== "tres" && !dialogoAberto}
        aoFechar={fecharPainel} focarAoAbrir={painelAberto === true} className={classesDoPainel(painelAberto, vista)}>{painel}</PainelContato>}
      {tarefaAberta&&modalTarefa&&<ModalTarefa key={aberturaTarefa} atendimentoId={modalTarefa.atendimentoId} modo={modalTarefa.modo.tipo==="editar"&&tarefaAtualDoModal?{tipo:"editar",tarefa:{id:tarefaAtualDoModal.id,versao:tarefaAtualDoModal.versao}}:modalTarefa.modo} alvoDisponivel={modalTarefa.modo.tipo==="nova"||tarefasDoModal===undefined||!!tarefaAtualDoModal&&tarefaAtualDoModal.podeAgir} fuso={fuso} aoFechar={()=>setModalTarefa(t=>t?.sessao===modalTarefa.sessao?null:t)} aoSalvo={()=>{if(selecionadoRef.current===modalTarefa.atendimentoId&&sessaoTarefa.current===modalTarefa.sessao){setModalTarefa(null);recarregarLista();}}}/>}
      {perdaAberta && perdaOportunidade.atendimentoId && perdaOportunidade.id && <ModalPerda key={perdaOportunidade.sessao} oportunidadeId={perdaOportunidade.id} nome={perdaOportunidade.nome}
        acao={i => marcarPerdidoNoInbox(perdaOportunidade.atendimentoId!, i, perdaOportunidade.id!)}
        aoConcluir={() => { if (selecionadoRef.current === perdaOportunidade.atendimentoId) recarregarLista(); }}
        aoFechar={() => setPerdaOportunidade(p => p.sessao === perdaOportunidade.sessao ? { ...p, aberta: false } : p)} />}
      {editorAberto && selecionado && <GavetaContato key={selecionado} atendimentoId={selecionado} dados={detalhesDoContato.dado} erro={detalhesDoContato.erro} aoRecarregar={detalhesDoContato.recarregar}
        podeVerFicha={painelDoAberto?.dado?.cabecalho?.capacidades.verContato === true} aoFechar={() => setEdicaoContato({ atendimentoId: selecionado, aberta: false })} aoSalvo={recarregarLista} />}
    </div>
    </div>
  );
}
