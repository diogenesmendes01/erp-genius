"use client";

import { Suspense, lazy, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import type { DriverWhatsApp } from "@prisma/client";
import { IconMicrophone, IconMoodSmile, IconPaperclip, IconPlayerStop, IconSend, IconTrash } from "@tabler/icons-react";
import type { Resultado } from "@/server/_shared/resultado";
import { Botao } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { CLASSE_ITEM_MENU, CLASSE_PAINEL_MENU } from "@/components/Menu";
import { AVISO_RECURSO_MOTOR, mimeVozAceito, recursoDisponivel, type RecursoMotor } from "./recursos-canal";

const SeletorEmoji = lazy(() => import("./SeletorEmoji"));

export const MOTIVO_SEM_ENVIO = "Você não pode enviar nesta conversa.";
export const AVISO_NOTA = "Nota interna: fica só para a equipe e não é enviada ao contato.";
const MAX_BYTES_MIDIA = 10 * 1024 * 1024;

export interface PropsCompositor {
  atendimentoId: string;
  modo: "responder" | "nota";
  podeEnviar: boolean;
  driver: DriverWhatsApp;
  aoEnviarTexto(t: string): Promise<Resultado<unknown>>;
  aoEnviarMidia(url: string, legenda: string): Promise<Resultado<unknown>>;
  aoNota(t: string): Promise<Resultado>;
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

export function Compositor({ atendimentoId, modo, podeEnviar, driver, aoEnviarTexto, aoEnviarMidia, aoNota }: PropsCompositor) {
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

  useEffect(() => {
    setTexto(lerRascunho(atendimentoId, modo));
    setArquivo(null);
    setErro("");
  }, [atendimentoId, modo]);
  useEffect(() => () => {
    descartar.current = true;
    if (gravador.current?.state === "recording") gravador.current.stop();
  }, []);

  if (!podeEnviar) {
    return (
      <div className="border-t border-gray-200 bg-composer px-4 py-3 text-sm text-gray-700" role="status">
        {MOTIVO_SEM_ENVIO}
      </div>
    );
  }

  function mudar(v: string) {
    setTexto(v);
    gravarRascunho(atendimentoId, modo, v);
  }

  function escolherArquivo(f: File | undefined) {
    if (!f) return;
    if (f.size === 0 || f.size > MAX_BYTES_MIDIA) { setErro("Arquivo vazio ou acima de 10MB."); return; }
    setArquivo(f);
    setAnexos(false);
    setErro("");
  }

  async function subir(f: File): Promise<string | null> {
    const form = new FormData();
    form.append("file", f);
    form.append("atendimentoId", atendimentoId);
    const r = await fetch("/api/whatsapp/upload", { method: "POST", body: form, credentials: "same-origin" });
    const j = (await r.json().catch(() => ({}))) as { url?: string; erro?: string };
    if (!r.ok || !j.url) { setErro(j.erro ?? "Falha no upload."); return null; }
    return j.url;
  }

  async function enviar() {
    const corpo = texto.trim();
    if (enviando || (!corpo && !arquivo)) return;
    setEnviando(true);
    setErro("");
    try {
      let r: Resultado<unknown>;
      if (nota) r = await aoNota(corpo);
      else if (arquivo) {
        const url = await subir(arquivo);
        if (!url) return;
        r = await aoEnviarMidia(url, corpo);
      } else r = await aoEnviarTexto(corpo);
      if (!r.ok) { setErro(r.erro); return; }
      mudar("");
      setArquivo(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      setEnviando(false);
    }
  }

  function aoTeclar(e: KeyboardEvent<HTMLTextAreaElement>) {
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
      const g = new MediaRecorder(fluxo, { mimeType: formato });
      const pedacos: BlobPart[] = [];
      descartar.current = false;
      g.ondataavailable = (ev) => { if (ev.data.size) pedacos.push(ev.data); };
      g.onstop = () => {
        fluxo.getTracks().forEach((t) => t.stop());
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
      setErro((e as Error).name === "NotAllowedError" ? "Permita o acesso ao microfone nas configurações do navegador." : "Não foi possível gravar.");
    }
  }

  function abrirSeletor(accept: string) {
    if (seletor.current) { seletor.current.accept = accept; seletor.current.click(); }
    setAnexos(false);
  }

  const vazio = !texto.trim() && !arquivo;
  return (
    <div className="border-t border-gray-200 bg-composer px-3 py-2">
      {nota && <p className="mb-2 rounded bg-highlight px-3 py-1.5 text-xs text-gray-800" role="note">{AVISO_NOTA}</p>}
      {erro && <p role="alert" className="mb-2 text-sm text-red-700">{erro}</p>}
      {arquivo && (
        <div className="mb-2 flex items-center gap-2 rounded border border-gray-200 bg-surface px-3 py-1.5 text-sm">
          <span className="truncate">{arquivo.name}</span>
          <small className="text-gray-600">{tamanho(arquivo.size)}</small>
          <button type="button" aria-label="Remover anexo" disabled={enviando} onClick={() => setArquivo(null)} className="ml-auto rounded p-1 hover:bg-highlight">
            <IconTrash size={16} aria-hidden />
          </button>
        </div>
      )}
      {emoji && (
        <div className="mb-2">
          <Suspense fallback={<div className="p-3 text-sm">Carregando…</div>}>
            <SeletorEmoji gif={recursoDisponivel(driver, "gif")} figurinha={recursoDisponivel(driver, "figurinha")} aoEmoji={inserirEmoji} aoFechar={() => setEmoji(false)} />
          </Suspense>
        </div>
      )}
      <div className="relative flex items-end gap-2">
        {!nota && (
          <>
            <button type="button" aria-label="Anexar" aria-haspopup="menu" aria-expanded={anexos} onClick={() => setAnexos(!anexos)} className="rounded-full p-2 hover:bg-highlight">
              <IconPaperclip size={20} aria-hidden />
            </button>
            {anexos && (
              <div role="menu" aria-label="Anexar" className={`absolute bottom-12 left-0 z-20 ${CLASSE_PAINEL_MENU}`}>
                <button type="button" role="menuitem" className={`${CLASSE_ITEM_MENU} text-gray-800`} onClick={() => abrirSeletor("*/*")}>Documento</button>
                <button type="button" role="menuitem" className={`${CLASSE_ITEM_MENU} text-gray-800`} onClick={() => abrirSeletor("image/*,video/*")}>Fotos e vídeos</button>
                <button type="button" role="menuitem" className={`${CLASSE_ITEM_MENU} text-gray-800`} onClick={() => abrirSeletor("audio/*")}>Áudio</button>
                {ITENS_MOTOR.map((i) => {
                  const livre = recursoDisponivel(driver, i.recurso);
                  return (
                    <div key={i.recurso}>
                      <button type="button" role="menuitem" disabled={!livre} className={`${CLASSE_ITEM_MENU} text-gray-800`}>{i.rotulo}</button>
                      {!livre && <small className="block px-5 pb-1 text-xs text-gray-600">{AVISO_RECURSO_MOTOR}</small>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        <button type="button" aria-label="Emojis" aria-pressed={emoji} onClick={() => setEmoji(!emoji)} className="rounded-full p-2 hover:bg-highlight">
          <IconMoodSmile size={20} aria-hidden />
        </button>
        <CampoTexto
          ref={entrada}
          aria-label={nota ? "Escreva uma nota interna" : "Digite uma mensagem"}
          placeholder={nota ? "Escreva uma nota interna" : "Digite uma mensagem"}
          rows={1}
          value={texto}
          disabled={enviando || gravando}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => mudar(e.target.value)}
          onKeyDown={aoTeclar}
          onPaste={(e) => { const f = e.clipboardData?.files?.[0]; if (f && !nota) { e.preventDefault(); escolherArquivo(f); } }}
          className="max-h-36 min-h-[40px] flex-1 resize-none rounded-[9px] border border-gray-200 bg-surface px-3 py-2 text-sm"
        />
        {gravando ? (
          <button type="button" aria-label="Parar e revisar áudio" onClick={() => gravador.current?.stop()} className="rounded-full p-2 hover:bg-highlight">
            <IconPlayerStop size={20} aria-hidden />
          </button>
        ) : vazio && !nota ? (
          <button type="button" aria-label="Gravar mensagem de voz" onClick={() => void iniciarGravacao()} className="rounded-full p-2 hover:bg-highlight">
            <IconMicrophone size={20} aria-hidden />
          </button>
        ) : (
          <Botao disabled={vazio} ocupado={enviando} onClick={() => void enviar()}>
            <IconSend size={16} aria-hidden />Enviar
          </Botao>
        )}
      </div>
      <input hidden ref={seletor} type="file" aria-label="Escolher arquivo" onChange={(e) => { escolherArquivo(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
