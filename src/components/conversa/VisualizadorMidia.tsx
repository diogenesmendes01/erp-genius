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

const ehPdf = (url: string) => /\.pdf$/i.test(url.split("?")[0]);

/**
 * Documento no visualizador. PDF vai num iframe SEM `sandbox`: o visualizador de PDF embutido do Chrome e do Firefox
 * não roda em iframe com sandbox sem `allow-scripts`, e o quadro sairia em branco. Sem sandbox é seguro aqui: a origem
 * é a mesma, `/api/files` já autoriza o arquivo e só serve tipos da lista fechada (`contentTypePorExtensao`: como
 * documento, só `application/pdf`; nada de HTML/SVG). Sempre há "Abrir em nova aba" para quando o navegador não embute PDF.
 */
export function QuadroDocumento({ url, nome }: { url: string; nome: string }) {
  return (
    <>
      {ehPdf(url) && <iframe src={url} title={nome} className="h-[60dvh] w-full" />}
      <a href={url} target="_blank" rel="noopener noreferrer" className="underline">Abrir em nova aba</a>
    </>
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
          : m.tipo === "DOCUMENTO" ? <QuadroDocumento url={url} nome={nome} />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={url} alt={m.corpo || "Imagem da conversa"} className="max-h-[60dvh] max-w-full object-contain" />}
        {m.corpo && <p>{m.corpo}</p>}
        <a href={url} download={nome} className="inline-flex items-center gap-2 underline"><IconDownload size={18} aria-hidden /> Baixar arquivo</a>
      </div>
    </Modal>
  );
}
