"use client";

import { IconDownload, IconFile, IconMicrophone, IconPlayerPlay } from "@tabler/icons-react";
import { Modal } from "@/components/Modal";
import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";

/** A mídia vem de `midiaPath` em `/api/files` (rota autenticada); nunca de API do motor. */
export const nomeArquivo = (path: string) => decodeURIComponent(path.split("?")[0].split("/").pop() || "arquivo");
const ehMidiaVisual = (tipo: string) => tipo === "IMAGEM" || tipo === "VIDEO" || tipo === "DOCUMENTO";
export const temMidia = (m: Pick<MensagemThread, "tipo" | "midiaPath">) => !!m.midiaPath && ["IMAGEM", "VIDEO", "AUDIO", "DOCUMENTO"].includes(m.tipo);

/** Pré-visualização dentro do balão. */
export function MidiaMensagem({ m, aoAbrir }: { m: Pick<MensagemThread, "tipo" | "midiaPath" | "corpo">; aoAbrir?: () => void }) {
  const url = m.midiaPath;
  if (!url) return null;
  if (m.tipo === "IMAGEM") {
    return (
      <button type="button" aria-label="Abrir imagem" onClick={aoAbrir} className="block overflow-hidden rounded-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={m.corpo || "Imagem da conversa"} loading="lazy" className="max-h-72 max-w-full object-cover" />
      </button>
    );
  }
  if (m.tipo === "VIDEO") {
    return (
      <button type="button" aria-label="Reproduzir vídeo" onClick={aoAbrir} className="relative block overflow-hidden rounded-md">
        <video src={url} preload="metadata" muted playsInline className="max-h-72 max-w-full" />
        <span className="absolute inset-0 flex items-center justify-center"><IconPlayerPlay size={32} aria-hidden /></span>
      </button>
    );
  }
  if (m.tipo === "AUDIO") {
    return (
      <div className="flex items-center gap-2"><IconMicrophone size={20} aria-hidden /><audio controls preload="metadata" src={url} aria-label="Áudio da conversa" /></div>
    );
  }
  const nome = nomeArquivo(url);
  return (
    <div className="flex items-center gap-2 text-sm">
      <IconFile size={28} aria-hidden />
      <strong className="break-all">{nome}</strong>
      <button type="button" onClick={aoAbrir} className="underline">Abrir</button>
      <a href={url} download={nome} className="underline">Salvar como…</a>
    </div>
  );
}

/** Visualizador em diálogo (imagem, vídeo, documento): Escape/fundo fecham e o foco volta (Modal/useDialogo). */
export function VisualizadorMidia({ m, aoFechar }: { m: Pick<MensagemThread, "tipo" | "midiaPath" | "corpo" | "criadoEm" | "autorNome">; aoFechar: () => void }) {
  const url = m.midiaPath;
  if (!url || !ehMidiaVisual(m.tipo)) return null;
  const nome = nomeArquivo(url);
  return (
    <Modal titulo={m.autorNome || "Mídia da conversa"} aoFechar={aoFechar} larga>
      <div className="flex flex-col gap-3">
        {m.tipo === "VIDEO" ? <video src={url} controls playsInline className="max-h-[60dvh] max-w-full" />
          : m.tipo === "DOCUMENTO" ? <iframe src={url} title={nome} sandbox="allow-same-origin" className="h-[60dvh] w-full" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={url} alt={m.corpo || "Imagem da conversa"} className="max-h-[60dvh] max-w-full object-contain" />}
        {m.corpo && <p>{m.corpo}</p>}
        <a href={url} download={nome} className="inline-flex items-center gap-2 underline"><IconDownload size={18} aria-hidden /> Baixar arquivo</a>
      </div>
    </Modal>
  );
}
