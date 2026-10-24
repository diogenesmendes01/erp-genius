"use client";

import { Suspense, lazy, useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { IconCalendarEvent, IconMicrophone, IconMoodSmile, IconPaperclip, IconPlayerStop, IconSend, IconTrash } from "@tabler/icons-react";
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

import { useRevisoesRascunhos, type RevisoesRascunhos } from "./rascunhos-conversa";

const SeletorEmoji = lazy(() => import("./SeletorEmoji"));

export const MOTIVO_SEM_ENVIO = "Você não pode enviar nesta conversa.";
export const CARREGANDO_ENVIO = "Carregando…";
export const FALHA_PERMISSAO_ENVIO = "Não foi possível verificar se você pode enviar nesta conversa.";
export const AVISO_NOTA = "Nota interna: fica só para a equipe e não é enviada ao contato.";
export const AVISO_ANEXO_EM_BREVE = "O envio deste tipo pelo Inbox ainda não está disponível.";
const MAX_BYTES_MIDIA = 10 * 1024 * 1024;

export interface PropsCompositor {
  atendimentoId: string;
  modo: "responder" | "nota";
  /** null: a permissão ainda não chegou (carregando). Só false é falta de permissão. Falha fechada: só true envia. */
  podeEnviar: boolean | null;
  /** Presente quando a permissão não pôde ser carregada: o compositor mostra o erro e este é o "Tentar de novo". */
  falhaPermissao?: () => void;
  /** `ThreadConversa.capacidades`: recursos que o número executa agora (motor ativo e sessão CONECTADO). */
  capacidades: readonly RecursoMotor[];
  aoEnviarTexto(t: string): Promise<Resultado<unknown>>;
  aoEnviarMidia(url: string, legenda: string): Promise<Resultado<unknown>>;
  aoNota(t: string, chaveIdempotencia?: string, mencoes?: readonly TokenMencao[]): Promise<Resultado>;
  /** Opcional: só o Inbox oferece candidatos já autorizados, sem alterar outros consumidores. */
  buscarMencoes?: (busca: string, signal?: AbortSignal) => Promise<CandidatoMencao[]>;
  /** Compartilhado pelo dono da conversa para conservar tentativa incerta mesmo ao alternar contatos. */
  tentativasNota?: ChavesPorAlvo;
  /** Dono acima da key do contato: evita apagar uma nova intenção após remontagem. */
  revisoesRascunhos?: RevisoesRascunhos;
  aoAgendar?: () => void;
  /** O rodapé hospeda a moldura; controles e estados continuam sendo deste componente. */
  contido?: boolean;
  /** Respostas rápidas do atendente (atalho "/"); sem elas o atalho não abre. */
  respostas?: readonly RespostaDoCompositor[];
  /** Valores das variáveis das respostas ({nome}, {responsavel}, {curso}). */
  variaveisResposta?: { nome?: string | null; responsavel?: string | null; curso?: string | null };
}

const chaveRascunho = (id: string, modo: string) => `conversa-rascunho:${id}:${modo}`;
function lerRascunho(id: string, modo: string): string {
  try { return localStorage.getItem(chaveRascunho(id, modo)) ?? ""; } catch { return ""; }
}
function gravarRascunho(id: string, modo: string, v: string) {
  try { if (v) localStorage.setItem(chaveRascunho(id, modo), v); else localStorage.removeItem(chaveRascunho(id, modo)); } catch { /* sem armazenamento: o rascunho não persiste */ }
}

const tamanho = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Primeiro formato de gravação que o navegador suporta e que o envio de voz aceita; null quando nenhum. */
function formatoDeVoz(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return ["audio/ogg;codecs=opus", "audio/mp4"].find((t) => mimeVozAceito(t) && MediaRecorder.isTypeSupported(t)) ?? null;
}

const ITENS_MOTOR: { rotulo: string; recurso: RecursoMotor }[] = [
  { rotulo: "Contato", recurso: "cartaoContato" },
  { rotulo: "Enquete", recurso: "enquete" },
  { rotulo: "Localização", recurso: "localizacao" },
];

export function Compositor({ atendimentoId, modo, podeEnviar, falhaPermissao, capacidades, aoEnviarTexto, aoEnviarMidia, aoNota, buscarMencoes, respostas = [], variaveisResposta = {}, tentativasNota, revisoesRascunhos, aoAgendar, contido = false }: PropsCompositor) {
  const idAvisosAnexos = useId();
  const [texto, setTexto] = useState(() => lerRascunho(atendimentoId, modo));
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [anexos, setAnexos] = useState(false);
  const [gravando, setGravando] = useState(false);
  const entrada = useRef<HTMLTextAreaElement | null>(null);
  const seletor = useRef<HTMLInputElement | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const descartar = useRef(false);
  const nota = modo === "nota";
  const listaMencoesId = useId();
  const [tokensMencao, setTokensMencao] = useState<TokenMencao[]>([]);
  const [consultaMencao, setConsultaMencao] = useState<ReturnType<typeof consultaMencaoNoCursor>>(null);
  const [respostaMencao, setRespostaMencao] = useState<{ consulta: NonNullable<typeof consultaMencao>; pessoas: CandidatoMencao[]; erro?: string } | null>(null);
  const [opcaoMencao, setOpcaoMencao] = useState(0);
  const tentativasLocais = useChavesPorAlvo();
  const tentativas = tentativasNota ?? tentativasLocais;
  const revisoesLocais = useRevisoesRascunhos();
  const revisoes = revisoesRascunhos ?? revisoesLocais;

  // Troca de atendimento ou de modo: o estado é ajustado no próprio render (estado derivado da prop, com a chave
  // anterior guardada), sem setState dentro de effect (react-hooks/set-state-in-effect). O React descarta este render
  // e refaz com o rascunho da conversa nova; o anexo e o erro da anterior não passam para ela.
  const chave = chaveRascunho(atendimentoId, modo);
  const [contexto, setContexto] = useState(() => ({ chave }));
  const contextoAtual = useRef<typeof contexto | null>(contexto);
  const emCurso = useRef(new Set<object>());
  const revisaoRascunho = useRef(0);
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
  // O value controlado precisa estar no DOM antes de aplicar indices UTF16.
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
  // O placeholder pode ocupar mais linhas que o campo vazio apos um ACK.
  // Reconciliar somente a rolagem do value ja commitado, sem mover foco/cursor.
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

  function registrarIntencao() {
    revisaoRascunho.current += 1;
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
    if (!contextoVigente() || enviando || emCurso.current.has(contexto) || (!corpo && !arquivo)) return;
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
        // Confirma a tentativa de A mesmo se a pessoa já estiver em B; só o estado visual exige contexto vigente.
        tentativa.depoisDo(desfecho);
        r = desfecho.tipo === "ok" ? { ok: true } : { ok: false, erro: desfecho.mensagem };
      }
      else if (arquivo) {
        const url = await subir(arquivo, revisaoEnviada);
        if (!url) return;
        r = await aoEnviarMidia(url, corpo);
      } else r = await aoEnviarTexto(corpo);
      // Sucesso de A em B limpa apenas o armazenamento exato da tentativa confirmada.
      // A→B→A sem editar conserva a intenção; texto/emoji/arquivo novos revogam a limpeza antiga.
      if (r.ok && intencaoEnviada && revisoes.confere(chave, intencaoEnviada)) {
        let corresponde = false;
        try {
          const persistido = localStorage.getItem(chave);
          corresponde = persistido === texto || (persistido === null && texto === "");
          if (corresponde) localStorage.removeItem(chave);
        } catch { corresponde = true; /* Sem persistência, ainda reconciliamos a intenção visual confirmada. */ }
        if (corresponde) revisoes.confirmar(chave, intencaoEnviada);
      }
      // A tentativa conclui sua chave, mas não substitui uma intenção editada durante o envio.
      if (!contextoVigente() || revisaoRascunho.current !== revisaoEnviada) return;
      if (!r.ok) { setErro(r.erro); return; }
      // A confirmação reconciliou somente o owner atual da mesma intenção.
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
    // Pular um espaco do sufixo existente ou o separador que acabamos de inserir.
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
    setErro("");
    const formato = formatoDeVoz();
    if (!formato || !navigator.mediaDevices?.getUserMedia) {
      setErro("Este navegador não grava voz em formato aceito. Anexe um áudio (OGG, MP3 ou M4A).");
      return;
    }
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!contextoVigente()) { fluxo.getTracks().forEach(t => t.stop()); return; }
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

  function abrirSeletor(accept: string) {
    if (seletor.current) { seletor.current.accept = accept; seletor.current.click(); }
    setAnexos(false);
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
        // Lista simples de botões (Tab chega a cada um): listbox exigiria foco gerenciado e setas.
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
            <button type="button" aria-label="Anexar" aria-haspopup="menu" aria-expanded={anexos} onClick={() => setAnexos(!anexos)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-600 hover:bg-highlight">
              <IconPaperclip size={20} aria-hidden />
            </button>
            {anexos && (
              <div role="menu" aria-label="Anexar" className={`absolute bottom-12 left-0 z-20 ${CLASSE_PAINEL_MENU}`}>
                <button type="button" role="menuitem" className={`${CLASSE_ITEM_MENU} text-gray-800`} onClick={() => abrirSeletor("*/*")}>Documento</button>
                <button type="button" role="menuitem" className={`${CLASSE_ITEM_MENU} text-gray-800`} onClick={() => abrirSeletor("image/*,video/*")}>Fotos e vídeos</button>
                <button type="button" role="menuitem" className={`${CLASSE_ITEM_MENU} text-gray-800`} onClick={() => abrirSeletor("audio/*")}>Áudio</button>
                {ITENS_MOTOR.map((i) => {
                  const temCapacidade = capacidades.includes(i.recurso);
                  return (
                    <div key={i.recurso}>
                      <button type="button" role="menuitem" disabled aria-describedby={idAvisosAnexos + "-" + i.recurso} className={`${CLASSE_ITEM_MENU} text-gray-800`}>{i.rotulo}</button>
                      <small id={idAvisosAnexos + "-" + i.recurso} className="block px-5 pb-1 text-xs text-gray-600">{temCapacidade ? AVISO_ANEXO_EM_BREVE : AVISO_RECURSO_MOTOR}</small>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {!nota && aoAgendar && <button type="button" aria-label="Agendar mensagem" title="Agendar mensagem" onClick={aoAgendar} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-600 hover:bg-highlight"><IconCalendarEvent size={18} aria-hidden /></button>}
        <button type="button" aria-label="Emojis" aria-pressed={emoji} onClick={() => setEmoji(!emoji)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-600 hover:bg-highlight">
          <IconMoodSmile size={20} aria-hidden />
        </button>
        <CampoTexto
          ref={entrada}
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
