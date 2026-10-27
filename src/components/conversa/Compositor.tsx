"use client";
import type { PublicarPortaRascunhoInsight } from "./rascunho-insight";

import Link from "next/link";
import { Suspense, lazy, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { IconCalendarEvent, IconChevronLeft, IconFileCheck, IconMicrophone, IconMoodSmile, IconPaperclip, IconPlayerStop, IconSend, IconTrash } from "@tabler/icons-react";
import { comandoDaNota, consultaMencaoNoCursor, tokensAposEdicao, type CandidatoMencao, type TokenMencao } from "@/lib/mencoes-nota";
import type { Resultado } from "@/server/_shared/resultado";
import { executarAcaoCliente } from "@/lib/acao-cliente";
import { useChavesPorAlvo, type ChavesPorAlvo } from "@/lib/chave-idempotencia";
import { Botao } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";
import { CLASSE_ITEM_MENU, CLASSE_PAINEL_MENU } from "@/components/Menu";
import { aplicarVariaveisResposta, respostasDoAtalho, type RespostaDoCompositor } from "./respostas-rapidas";
import { AVISO_RECURSO_MOTOR, mimeVozAceito, type RecursoMotor } from "./recursos-canal";
import { ITENS_ANEXO, type IdItemAnexo } from "./itens-anexo";
import type { PropostaAnexavel } from "@/server/whatsapp/proposta-atendimento";
import type { ConteudoEspecial } from "@/server/whatsapp/canal";
import { FormEnquete } from "./anexos/FormEnquete";
import { FormLocalizacao } from "./anexos/FormLocalizacao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";

import { useRevisoesRascunhos, type RevisoesRascunhos } from "./rascunhos-conversa";

const SeletorEmoji = lazy(() => import("./SeletorEmoji"));

export const MOTIVO_SEM_ENVIO = "Você não pode enviar nesta conversa.";
export const CARREGANDO_ENVIO = "Carregando…";
export const FALHA_PERMISSAO_ENVIO = "Não foi possível verificar se você pode enviar nesta conversa.";
export const AVISO_NOTA = "Nota interna: fica só para a equipe e não é enviada ao contato.";
export const AVISO_ANEXO_EM_BREVE = "O envio deste tipo pelo Inbox ainda não está disponível.";
export const SEM_PROPOSTAS = "Nenhuma proposta anexada a esta oportunidade.";
const MAX_BYTES_MIDIA = 10 * 1024 * 1024;

export interface PropsCompositor {
  atendimentoId: string;
  pedidoFoco?: number;
  aoCampoResponder?: (campo: HTMLTextAreaElement | null) => void;
  modo: "responder" | "nota";
  bloqueioExterno?: boolean;
  podeEnviar: boolean | null;
  falhaPermissao?: () => void;
  capacidades: readonly RecursoMotor[];
  aoEnviarTexto(t: string): Promise<Resultado<unknown>>;
  aoEnviarMidia(url: string, legenda: string): Promise<Resultado<unknown>>;
  aoNota(t: string, chaveIdempotencia?: string, mencoes?: readonly TokenMencao[]): Promise<Resultado>;
  buscarMencoes?: (busca: string, signal?: AbortSignal) => Promise<CandidatoMencao[]>;
  tentativasNota?: ChavesPorAlvo;
  revisoesRascunhos?: RevisoesRascunhos;
  aoAgendar?: () => void;
  aoPortaRascunhoInsight?: PublicarPortaRascunhoInsight;
  contido?: boolean;
  respostas?: readonly RespostaDoCompositor[];
  propostas?: { oportunidadeId: string | null; itens: readonly PropostaAnexavel[]; fuso?: string | null };
  aoEnviarProposta?(documentoId: string, chaveIdempotencia?: string): Promise<Resultado<unknown>>;
  aoEnviarConteudo?(c: ConteudoEspecial): Promise<Resultado<unknown>>;
  variaveisResposta?: { nome?: string | null; responsavel?: string | null; curso?: string | null };
}

type FormConteudo = "enquete" | "localizacao";
const ehFormConteudo = (id: IdItemAnexo): id is FormConteudo => id === "enquete" || id === "localizacao";

const chaveRascunho = (id: string, modo: string) => `conversa-rascunho:${id}:${modo}`;
function lerRascunho(id: string, modo: string): string {
  try { return localStorage.getItem(chaveRascunho(id, modo)) ?? ""; } catch { return ""; }
}
function gravarRascunho(id: string, modo: string, v: string) {
  try { if (v) localStorage.setItem(chaveRascunho(id, modo), v); else localStorage.removeItem(chaveRascunho(id, modo)); } catch {  }
}

const tamanho = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

function formatoDeVoz(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return ["audio/ogg;codecs=opus", "audio/mp4"].find((t) => mimeVozAceito(t) && MediaRecorder.isTypeSupported(t)) ?? null;
}

export function Compositor({ atendimentoId, pedidoFoco, aoCampoResponder, modo, bloqueioExterno = false, podeEnviar, falhaPermissao, capacidades, aoEnviarTexto, aoEnviarMidia, aoNota, buscarMencoes, respostas = [], propostas, aoEnviarProposta, aoEnviarConteudo, variaveisResposta = {}, tentativasNota, revisoesRascunhos, aoAgendar, aoPortaRascunhoInsight, contido = false }: PropsCompositor) {
  const idAvisosAnexos = useId();
  const [texto, setTexto] = useState(() => lerRascunho(atendimentoId, modo));
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [anexos, setAnexos] = useState(false);
  const [listaPropostas, setListaPropostas] = useState(false);
  const [formConteudo, setFormConteudo] = useState<FormConteudo | null>(null);
  const [gravando, setGravando] = useState(false);
  const entrada = useRef<HTMLTextAreaElement | null>(null);
  const focoAtendido=useRef<{atendimentoId:string;pedido:number}|null>(null);
  const ligarEntrada = useCallback((campo: HTMLTextAreaElement | null) => { entrada.current = campo; aoCampoResponder?.(modo === "responder" ? campo : null); }, [aoCampoResponder, modo]);
  const seletor = useRef<HTMLInputElement | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const descartar = useRef(false);
  const nota = modo === "nota";
  const [geracaoEnvio, setGeracaoEnvio] = useState(() => ({ bloqueada: bloqueioExterno, token: {} }));
  if (geracaoEnvio.bloqueada !== bloqueioExterno) setGeracaoEnvio({ bloqueada: bloqueioExterno, token: {} });
  const geracaoAtual = useRef<typeof geracaoEnvio | null>(geracaoEnvio);
  useLayoutEffect(() => { geracaoAtual.current = geracaoEnvio; return () => { if (geracaoAtual.current === geracaoEnvio) geracaoAtual.current = null; }; }, [geracaoEnvio]);
  const saidaPermitida = () => nota || (!bloqueioExterno && geracaoAtual.current === geracaoEnvio);
  useEffect(() => { if (!nota && bloqueioExterno && gravador.current?.state === "recording") { descartar.current = true; gravador.current.stop(); } }, [nota, bloqueioExterno]);
  const listaMencoesId = useId();
  const [tokensMencao, setTokensMencao] = useState<TokenMencao[]>([]);
  const [consultaMencao, setConsultaMencao] = useState<ReturnType<typeof consultaMencaoNoCursor>>(null);
  const [respostaMencao, setRespostaMencao] = useState<{ consulta: NonNullable<typeof consultaMencao>; pessoas: CandidatoMencao[]; erro?: string } | null>(null);
  const [opcaoMencao, setOpcaoMencao] = useState(0);
  const tentativasLocais = useChavesPorAlvo();
  const tentativas = tentativasNota ?? tentativasLocais;
  const tentativasPropostas = useChavesPorAlvo();
  const propostaDisponivel = !!propostas?.oportunidadeId && typeof aoEnviarProposta === "function";
  const revisoesLocais = useRevisoesRascunhos();
  const revisoes = revisoesRascunhos ?? revisoesLocais;

  const chave = chaveRascunho(atendimentoId, modo);
  const [contexto, setContexto] = useState(() => ({ chave }));
  const contextoAtual = useRef<typeof contexto | null>(contexto);
  const emCurso = useRef(new Set<object>());
  const revisaoRascunho = useRef(0);
  const [revisaoPonteInsight,setRevisaoPonteInsight]=useState(0);
  const selecaoMencao = useRef<{ contexto: typeof contexto; revisao: number; texto: string; indice: number } | null>(null);
  if (contexto.chave !== chave) {
    setContexto({ chave });
    setTexto(lerRascunho(atendimentoId, modo));
    setTokensMencao([]);
    setConsultaMencao(null);
    setArquivo(null);
    setErro("");
    setEnviando(false);
    setEmoji(false);
    setAnexos(false);
    setListaPropostas(false);
    setFormConteudo(null);
    setGravando(false);
  }
  useLayoutEffect(() => {
    contextoAtual.current = contexto;
    const cancelar = revisoes.registrar(chave, contexto, () => {
      if (contextoAtual.current !== contexto) return;
      revisaoRascunho.current += 1;
      revisoes.alterar(chave, contexto);
      setTexto("");
      setTokensMencao([]);
      setConsultaMencao(null);
      setArquivo(null);
    });
    return () => { cancelar(); if (contextoAtual.current === contexto) contextoAtual.current = null; };
  }, [contexto, chave, revisoes]);
  useLayoutEffect(()=>{
    if(modo!=="nota"||pedidoFoco===undefined||contextoAtual.current!==contexto||!entrada.current)return;
    if(focoAtendido.current?.atendimentoId===atendimentoId&&focoAtendido.current.pedido===pedidoFoco)return;
    focoAtendido.current={atendimentoId,pedido:pedidoFoco};entrada.current.focus({preventScroll:true});
  },[atendimentoId,modo,pedidoFoco,contexto]);
  useLayoutEffect(() => {
    const selecao = selecaoMencao.current;
    if (!selecao) return;
    selecaoMencao.current = null;
    const campo = entrada.current;
    if (selecao.contexto !== contextoAtual.current || selecao.revisao !== revisaoRascunho.current
      || !campo || campo.value !== selecao.texto) return;
    campo.focus();
    campo.setSelectionRange?.(selecao.indice, selecao.indice);
  });
  useLayoutEffect(() => {
    const campo = entrada.current;
    if (texto === "" && campo?.value === "") campo.scrollTop = 0;
  }, [texto, contexto]);
  const contextoVigente = () => contextoAtual.current === contexto;
  useEffect(() => () => {
    descartar.current = true;
    if (gravador.current?.state === "recording") gravador.current.stop();
  }, [contexto]);

  useEffect(() => {
    if (!nota || !buscarMencoes || enviando || !consultaMencao) return;
    let vigente = true;
    const consulta = consultaMencao;
    const controlador = new AbortController();
    const timer = setTimeout(() => {
      void Promise.resolve().then(() => buscarMencoes(consulta.busca, controlador.signal)).then(
        pessoas => { if (vigente) setRespostaMencao({ consulta, pessoas }); },
        () => { if (vigente) setRespostaMencao({ consulta, pessoas: [], erro: "Não foi possível buscar pessoas." }); },
      );
    }, 200);
    return () => { vigente = false; clearTimeout(timer); controlador.abort(); };
  }, [nota, buscarMencoes, enviando, consultaMencao, contexto]);
  const consultandoMencao = nota && !!buscarMencoes && !enviando && consultaMencao !== null;
  const resultadoMencao = respostaMencao?.consulta === consultaMencao ? respostaMencao : null;
  const opcoesMencao = consultandoMencao ? resultadoMencao?.pessoas ?? [] : [];
  const indiceMencao = Math.min(opcaoMencao, Math.max(0, opcoesMencao.length - 1));
  useLayoutEffect(() => {
    if (consultandoMencao && opcoesMencao.length) document.getElementById?.(listaMencoesId + "-" + indiceMencao)?.scrollIntoView?.({ block: "nearest" });
  }, [consultandoMencao, opcoesMencao.length, indiceMencao, listaMencoesId]);

  function registrarIntencao() {
    revisaoRascunho.current += 1;
    if(aoPortaRascunhoInsight)setRevisaoPonteInsight(r=>r+1);
    revisoes.alterar(chave, contexto);
  }

  function mudar(v: string, cursor = v.length) {
    if (!contextoVigente()) return;
    registrarIntencao();
    setTokensMencao(anteriores => tokensAposEdicao(texto, v, anteriores));
    const consulta = nota && buscarMencoes ? consultaMencaoNoCursor(v, cursor) : null;
    setConsultaMencao(consulta && consulta.busca.length >= 2 && !/\s$/.test(consulta.busca) ? consulta : null);
    setOpcaoMencao(0);
    setTexto(v);
    gravarRascunho(atendimentoId, modo, v);
  }

  const editarTextoInsight=useRef<(v:string)=>void>(()=>{});
  useLayoutEffect(()=>{editarTextoInsight.current=mudar;});

  useLayoutEffect(()=>{
    if(!aoPortaRascunhoInsight)return;
    if(nota||bloqueioExterno||podeEnviar!==true||enviando||!entrada.current){aoPortaRascunhoInsight(null);return;}
    let viva=true;
    const revisao=revisaoRascunho.current,revisaoInsight=`${idAvisosAnexos}:${revisaoRascunho.current}`;
    aoPortaRascunhoInsight({atendimentoId,textoAtual:texto,revisao:revisaoInsight,podeUsar:true,
      async usar(pedido){
        if(!viva||contextoAtual.current!==contexto||revisaoRascunho.current!==revisao||emCurso.current.has(contexto)
          ||pedido.revisaoEsperada!==revisaoInsight||typeof pedido.texto!=="string"||pedido.texto.length>4000)
          return {ok:false,erro:"O rascunho mudou. Revise a sugestão novamente."};
        editarTextoInsight.current(pedido.texto);return {ok:true};
      }});
    return()=>{viva=false;aoPortaRascunhoInsight(null);};
  },[aoPortaRascunhoInsight,atendimentoId,contexto,nota,bloqueioExterno,podeEnviar,enviando,texto,arquivo,revisaoPonteInsight,idAvisosAnexos]);
  if (!nota && bloqueioExterno) return null;
  if (!nota && podeEnviar !== true && falhaPermissao) {
    return (
      <div className={contido ? "flex flex-wrap items-center gap-2 text-sm" : "flex flex-wrap items-center gap-2 border-t border-gray-200 bg-surface px-4 py-3 text-sm"}>
        <p role="alert" className="text-red-700">{FALHA_PERMISSAO_ENVIO}</p>
        <Botao variante="secundario" tamanho="sm" onClick={falhaPermissao}>Tentar de novo</Botao>
      </div>
    );
  }
  if (!nota && podeEnviar === null) {
    return (
      <div className={contido ? "text-sm text-gray-700" : "border-t border-gray-200 bg-surface px-4 py-3 text-sm text-gray-700"} role="status">
        {CARREGANDO_ENVIO}
      </div>
    );
  }
  if (!nota && !podeEnviar) {
    return (
      <div className={contido ? "text-sm text-gray-700" : "border-t border-gray-200 bg-surface px-4 py-3 text-sm text-gray-700"} role="status">
        {MOTIVO_SEM_ENVIO}
      </div>
    );
  }

  function escolherArquivo(f: File | undefined) {
    if (!contextoVigente()) return;
    if (!f) return;
    if (f.size === 0 || f.size > MAX_BYTES_MIDIA) { setErro("Arquivo vazio ou acima de 10MB."); return; }
    registrarIntencao();
    setArquivo(f);
    setAnexos(false);
    setErro("");
  }

  async function subir(f: File, revisaoEnviada: number): Promise<string | null> {
    const form = new FormData();
    form.append("file", f);
    form.append("atendimentoId", atendimentoId);
    const r = await fetch("/api/whatsapp/upload", { method: "POST", body: form, credentials: "same-origin" });
    const j = (await r.json().catch(() => ({}))) as { url?: string; erro?: string };
    if (!contextoVigente() || revisaoRascunho.current !== revisaoEnviada) return null;
    if (!r.ok || !j.url) { setErro(j.erro ?? "Falha no upload."); return null; }
    return j.url;
  }

  async function enviar() {
    const corpo = texto.trim();
    if (!contextoVigente() || !saidaPermitida() || enviando || emCurso.current.has(contexto) || (!corpo && !arquivo)) return;
    const revisaoEnviada = revisaoRascunho.current;
    const intencaoEnviada = revisoes.capturar(chave, contexto);
    emCurso.current.add(contexto);
    setEnviando(true);
    setErro("");
    try {
      let r: Resultado<unknown>;
      if (nota) {
        const comando = comandoDaNota(texto, tokensMencao);
        const tokens = comando.mencoes === undefined ? undefined : Object.freeze(comando.mencoes.map(t => Object.freeze({ ...t })));
        const tentativa = tentativas.para(JSON.stringify(tokens === undefined ? [atendimentoId, comando.nota] : [atendimentoId, comando.nota, tokens]));
        const desfecho = await executarAcaoCliente(() => tokens === undefined ? aoNota(comando.nota, tentativa.atual) : aoNota(comando.nota, tentativa.atual, tokens), { idempotente: true });
        tentativa.depoisDo(desfecho);
        r = desfecho.tipo === "ok" ? { ok: true } : { ok: false, erro: desfecho.mensagem };
      }
      else if (arquivo) {
        const url = await subir(arquivo, revisaoEnviada);
        if (!url || !saidaPermitida()) return;
        r = await aoEnviarMidia(url, corpo);
      } else r = await aoEnviarTexto(corpo);
      if (r.ok && intencaoEnviada && revisoes.confere(chave, intencaoEnviada)) {
        let corresponde = false;
        try {
          const persistido = localStorage.getItem(chave);
          corresponde = persistido === texto || (persistido === null && texto === "");
          if (corresponde) localStorage.removeItem(chave);
        } catch { corresponde = true;  }
        if (corresponde) revisoes.confirmar(chave, intencaoEnviada);
      }
      if (!contextoVigente() || revisaoRascunho.current !== revisaoEnviada) return;
      if (!r.ok) { setErro(r.erro); return; }
    } catch (e) {
      if (contextoVigente() && revisaoRascunho.current === revisaoEnviada) setErro(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      emCurso.current.delete(contexto);
      if (contextoVigente()) setEnviando(false);
    }
  }

  function escolherMencao(p: CandidatoMencao) {
    if (!contextoVigente() || !consultaMencao || enviando) return;
    const { inicio, fim } = consultaMencao;
    const trecho = "@" + p.nome;
    const sufixo = texto.slice(fim);
    const separador = sufixo.startsWith(" ") ? "" : " ";
    const novo = texto.slice(0, inicio) + trecho + separador + sufixo;
    mudar(novo);
    setTokensMencao([...tokensAposEdicao(texto, novo, tokensMencao).filter(t => t.fim <= inicio || t.inicio >= inicio + trecho.length), { usuarioId: p.id, inicio, fim: inicio + trecho.length }]);
    setConsultaMencao(null);
    selecaoMencao.current = { contexto, revisao: revisaoRascunho.current, texto: novo, indice: inicio + trecho.length + 1 };
  }
  function aoTeclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return;
    if (consultandoMencao) {
      if (e.key === "Escape" || e.key === "Tab") { if (e.key === "Escape") e.preventDefault(); setConsultaMencao(null); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (opcoesMencao.length) setOpcaoMencao((indiceMencao + (e.key === "ArrowDown" ? 1 : opcoesMencao.length - 1)) % opcoesMencao.length); return; }
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (opcoesMencao.length) escolherMencao(opcoesMencao[indiceMencao]); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviar(); }
  }

  function inserirEmoji(v: string) {
    const el = entrada.current;
    const ini = el?.selectionStart ?? texto.length;
    const fim = el?.selectionEnd ?? texto.length;
    mudar(texto.slice(0, ini) + v + texto.slice(fim));
  }

  async function iniciarGravacao() {
    if (!saidaPermitida()) return;
    setErro("");
    const formato = formatoDeVoz();
    if (!formato || !navigator.mediaDevices?.getUserMedia) {
      setErro("Este navegador não grava voz em formato aceito. Anexe um áudio (OGG, MP3 ou M4A).");
      return;
    }
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!contextoVigente() || !saidaPermitida()) { fluxo.getTracks().forEach(t => t.stop()); return; }
      const g = new MediaRecorder(fluxo, { mimeType: formato });
      const pedacos: BlobPart[] = [];
      descartar.current = false;
      g.ondataavailable = (ev) => { if (ev.data.size) pedacos.push(ev.data); };
      g.onstop = () => {
        fluxo.getTracks().forEach((t) => t.stop());
        if (!contextoVigente()) return;
        setGravando(false);
        const tipo = g.mimeType || formato;
        if (descartar.current || !pedacos.length) return;
        if (!mimeVozAceito(tipo)) { setErro("Formato de voz não aceito."); return; }
        const base = tipo.split(";")[0];
        const ext = base === "audio/ogg" ? "ogg" : base === "audio/mpeg" ? "mp3" : "m4a";
        escolherArquivo(new File([new Blob(pedacos, { type: base })], `mensagem-de-voz.${ext}`, { type: base }));
      };
      gravador.current = g;
      g.start();
      setGravando(true);
    } catch (e) {
      if (contextoVigente()) setErro((e as Error).name === "NotAllowedError" ? "Permita o acesso ao microfone nas configurações do navegador." : "Não foi possível gravar.");
    }
  }

  function abrirSeletor(accept: string, captura?: "environment") {
    if (!contextoVigente() || !saidaPermitida()) return;
    if (seletor.current) {
      seletor.current.accept = accept;
      if (captura) seletor.current.capture = captura;
      else seletor.current.removeAttribute("capture");
      seletor.current.click();
    }
    setAnexos(false);
  }

  async function enviarProposta(documentoId: string) {
    if (!contextoVigente() || !saidaPermitida() || nota || podeEnviar !== true || !aoEnviarProposta || enviando || emCurso.current.has(contexto)) return;
    emCurso.current.add(contexto);
    setEnviando(true);
    setErro("");
    try {
      const tentativa = tentativasPropostas.para(JSON.stringify([atendimentoId, documentoId]));
      const desfecho = await executarAcaoCliente(() => aoEnviarProposta(documentoId, tentativa.atual), { idempotente: true });
      tentativa.depoisDo(desfecho);
      if (!contextoVigente()) return;
      if (desfecho.tipo === "ok") setListaPropostas(false);
      else setErro(desfecho.mensagem);
    } finally {
      emCurso.current.delete(contexto);
      if (contextoVigente()) setEnviando(false);
    }
  }

  async function enviarConteudo(c: ConteudoEspecial): Promise<Resultado<unknown>> {
    if (!contextoVigente() || !saidaPermitida() || nota || podeEnviar !== true || !aoEnviarConteudo) return { ok: false, erro: MOTIVO_SEM_ENVIO };
    return aoEnviarConteudo(c);
  }
  const conteudoAtivo = (id: IdItemAnexo) => {
    const item = ITENS_ANEXO.find((i) => i.id === id);
    return ehFormConteudo(id) && !!item?.recurso && capacidades.includes(item.recurso) && typeof aoEnviarConteudo === "function";
  };

  function selecionarAnexo(item: IdItemAnexo) {
    if (!contextoVigente() || !saidaPermitida() || nota || podeEnviar !== true) return;
    if (item === "documento") abrirSeletor("*/*");
    else if (item === "midia") abrirSeletor("image/*,video/*");
    else if (item === "camera") abrirSeletor("image/*", "environment");
    else if (item === "audio") abrirSeletor("audio/*");
    else if (item === "resposta" && respostas.length) {
      mudar("/");
      setAnexos(false);
      entrada.current?.focus();
    } else if (item === "proposta" && propostaDisponivel) {
      setAnexos(false);
      setListaPropostas(true);
    } else if (ehFormConteudo(item) && conteudoAtivo(item)) {
      setAnexos(false);
      setListaPropostas(false);
      setFormConteudo(item);
    }
  }
  const vazio = !texto.trim() && !arquivo;
  const sugestoes = nota ? [] : respostasDoAtalho(texto, respostas);
  return (
    <div className={contido ? "min-w-0" : "border-t border-gray-200 bg-surface px-4 py-3"}>
      {nota && <p className="mb-2 text-xs text-amber-700" role="note">{AVISO_NOTA}</p>}
      {erro && <p role="alert" className="mb-2 text-sm text-red-700">{erro}</p>}
      {arquivo && (
        <div className="mb-2 flex items-center gap-2 rounded border border-gray-200 bg-surface px-3 py-1.5 text-sm">
          <span className="truncate">{arquivo.name}</span>
          <small className="text-gray-600">{tamanho(arquivo.size)}</small>
          <button type="button" aria-label="Remover anexo" disabled={enviando} onClick={() => { registrarIntencao(); setArquivo(null); }} className="ml-auto rounded p-1 hover:bg-highlight">
            <IconTrash size={16} aria-hidden />
          </button>
        </div>
      )}
      {emoji && (
        <div className="mb-2">
          <Suspense fallback={<div className="p-3 text-sm">Carregando…</div>}>
            <SeletorEmoji gif={capacidades.includes("gif")} figurinha={capacidades.includes("figurinha")} aoEmoji={inserirEmoji} aoFechar={() => setEmoji(false)} />
          </Suspense>
        </div>
      )}
      {sugestoes.length > 0 && (
        <ul aria-label="Respostas rápidas" className={`mb-2 ${CLASSE_PAINEL_MENU}`}>
          {sugestoes.map((s) => (
            <li key={s.id}>
              <button type="button" className={`${CLASSE_ITEM_MENU} text-gray-800`} onClick={() => { mudar(aplicarVariaveisResposta(s.corpo, variaveisResposta)); entrada.current?.focus(); }}>
                <strong>{s.atalho}</strong> <span className="text-gray-600">{s.titulo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative flex items-end gap-2">
        {consultandoMencao && (
          <div className="absolute inset-x-0 bottom-full z-20 mb-2 rounded-lg border border-gray-200 bg-surface shadow-popover">
            <p className="px-3 py-2 text-xs text-gray-600">Selecione alguém na lista para avisar.</p>
            {!resultadoMencao ? <p role="status" className="px-3 pb-3 text-sm text-gray-600">Buscando pessoas…</p>
              : resultadoMencao.erro ? <p role="alert" className="px-3 pb-3 text-sm text-red-700">{resultadoMencao.erro}</p>
              : opcoesMencao.length ? <ul id={listaMencoesId} role="listbox" aria-label="Pessoas que podem ver a conversa" className="max-h-40 overflow-y-auto">
              {opcoesMencao.map((p, i) => <li key={p.id} role="presentation">
                <button id={listaMencoesId + "-" + i} type="button" role="option" aria-label={`Mencionar ${p.nome} · ${p.descricao}`} aria-selected={i === indiceMencao} tabIndex={-1}
                  className={CLASSE_ITEM_MENU + " w-full text-left " + (i === indiceMencao ? "bg-highlight" : "")}
                  onMouseDown={e => e.preventDefault()} onClick={() => escolherMencao(p)}>
                  <span className="block text-sm font-medium">{p.nome}</span><span className="block text-xs text-gray-600">{p.descricao}</span>
                </button>
              </li>)}
            </ul> : <EstadoVazio role="status" className="mx-3 mb-3">Nenhuma pessoa corresponde à busca.</EstadoVazio>}
          </div>
        )}
        {!nota && (
          <>
            <button type="button" aria-label="Anexar" aria-haspopup="menu" aria-expanded={anexos} onClick={() => { setListaPropostas(false); setFormConteudo(null); setAnexos(!anexos); }} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-600 hover:bg-highlight">
              <IconPaperclip size={20} aria-hidden />
            </button>
            {anexos && (
              <div role="menu" aria-label="Anexar" className={`absolute bottom-12 left-0 z-20 grid w-[340px] max-w-[calc(100vw-32px)] grid-cols-3 gap-1 ${CLASSE_PAINEL_MENU}`}>
                {ITENS_ANEXO.filter(i => i.id !== "resposta" || respostas.length > 0)
                  .filter(i => i.id !== "proposta" || propostaDisponivel)
                  .map(i => {
                    const Icone = i.icone;
                    const inativo = !!i.recurso && !conteudoAtivo(i.id);
                    const aviso = inativo && i.recurso ? (capacidades.includes(i.recurso) ? AVISO_ANEXO_EM_BREVE : AVISO_RECURSO_MOTOR) : null;
                    return <div key={i.id} className="min-w-0">
                      <button type="button" role="menuitem" aria-label={i.rotulo} disabled={inativo}
                        aria-describedby={inativo ? idAvisosAnexos + "-" + i.recurso : undefined}
                        className={`${CLASSE_ITEM_MENU} flex-col justify-center text-gray-800`} onClick={inativo ? undefined : () => selecionarAnexo(i.id)}>
                        <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${i.classeIcone}`}><Icone size={20} /></span><span className="text-center">{i.rotulo}</span>
                      </button>
                      {inativo && <small id={idAvisosAnexos + "-" + i.recurso} className="block px-2 pb-1 text-center text-xs text-gray-600">{aviso}</small>}
                    </div>;
                  })}
              </div>
            )}
            {formConteudo === "enquete" && conteudoAtivo("enquete") && <FormEnquete aoEnviar={enviarConteudo} aoFechar={() => setFormConteudo(null)} />}
            {formConteudo === "localizacao" && conteudoAtivo("localizacao") && <FormLocalizacao aoEnviar={enviarConteudo} aoFechar={() => setFormConteudo(null)} />}
            {listaPropostas && propostaDisponivel && propostas?.oportunidadeId && (
              <div role="dialog" aria-label="Enviar proposta" className={`absolute bottom-12 left-0 z-20 w-[340px] max-w-[calc(100vw-32px)] ${CLASSE_PAINEL_MENU}`}>
                <div className="flex items-center gap-1 px-1 pb-1">
                  <button type="button" aria-label="Voltar para anexos" onClick={() => { setListaPropostas(false); setAnexos(true); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-600 hover:bg-highlight"><IconChevronLeft size={18} aria-hidden /></button>
                  <p className="text-sm font-medium text-gray-800">Propostas da oportunidade</p>
                </div>
                {propostas.itens.length ? (
                  <ul aria-label="Propostas da oportunidade" className="max-h-64 overflow-y-auto">
                    {propostas.itens.map((d) => (
                      <li key={d.id}>
                        <button type="button" aria-label={`Enviar ${d.nome}`} disabled={enviando} aria-busy={enviando || undefined} onClick={() => void enviarProposta(d.id)} className={`${CLASSE_ITEM_MENU} w-full text-left text-gray-800 disabled:cursor-not-allowed disabled:opacity-50`}>
                          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700"><IconFileCheck size={18} /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{d.nome}</span>
                            <time dateTime={d.criadoEm} className="block text-xs text-gray-600">{formatarInstanteExibicao(d.criadoEm, propostas.fuso, "UTC", "data").texto}</time>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EstadoVazio role="status" className="mx-1 mb-1" acao={<Link href={`/funil?o=${encodeURIComponent(propostas.oportunidadeId)}`} className="text-sm font-medium text-brand-700 underline">Abrir oportunidade</Link>}>{SEM_PROPOSTAS}</EstadoVazio>
                )}
              </div>
            )}
          </>
        )}
        {!nota && aoAgendar && <button type="button" aria-label="Agendar mensagem" title="Agendar mensagem" onClick={aoAgendar} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-600 hover:bg-highlight"><IconCalendarEvent size={18} aria-hidden /></button>}
        <button type="button" aria-label="Emojis" aria-pressed={emoji} onClick={() => setEmoji(!emoji)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-600 hover:bg-highlight">
          <IconMoodSmile size={20} aria-hidden />
        </button>
        <CampoTexto
          ref={ligarEntrada}
          data-compositor-campo=""
          aria-label={nota ? "Escreva uma nota interna" : "Escreva uma mensagem"}
          placeholder={nota ? "Escreva uma nota interna" : "Escreva uma mensagem"}
          rows={1}
          value={texto}
          role={nota && buscarMencoes ? "combobox" : undefined}
          aria-autocomplete={nota && buscarMencoes ? "list" : undefined}
          aria-expanded={nota && buscarMencoes ? consultandoMencao : undefined}
          aria-controls={opcoesMencao.length ? listaMencoesId : undefined}
          aria-activedescendant={opcoesMencao.length ? listaMencoesId + "-" + indiceMencao : undefined}
          onBlur={() => setConsultaMencao(null)}
          disabled={enviando || gravando}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => mudar(e.target.value, e.target.selectionStart ?? e.target.value.length)}
          onKeyDown={aoTeclar}
          onPaste={(e) => { const f = e.clipboardData?.files?.[0]; if (f && !nota) { e.preventDefault(); escolherArquivo(f); } }}
          className={"min-h-[44px] max-h-[140px] min-w-0 flex-1 resize-none rounded-lg border px-3.5 py-[11px] text-sm leading-5 " + (nota ? "border-amber-600 bg-amber-50" : "border-gray-200 bg-surface-muted")}
        />
        {gravando ? (
          <button type="button" aria-label="Parar e revisar áudio" onClick={() => gravador.current?.stop()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-600 hover:bg-highlight">
            <IconPlayerStop size={20} aria-hidden />
          </button>
        ) : vazio && !nota ? (
          <button type="button" aria-label="Gravar mensagem de voz" onClick={() => void iniciarGravacao()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-600 hover:bg-highlight">
            <IconMicrophone size={20} aria-hidden />
          </button>
        ) : (
          <button type="button" disabled={vazio || enviando} aria-busy={enviando || undefined} onClick={() => void enviar()} className={"grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:cursor-not-allowed disabled:opacity-50 " + (nota ? "bg-amber-700 text-surface" : "bg-brand-solid text-on-brand")}>
            <IconSend size={18} aria-hidden /><span className="sr-only">Enviar</span>
          </button>
        )}
      </div>
      <input hidden ref={seletor} type="file" aria-label="Escolher arquivo" onChange={(e) => { escolherArquivo(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
