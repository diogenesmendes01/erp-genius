import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { TipoMensagem } from "@prisma/client";
import { UPLOAD_DIR, contentTypePorExtensao, resolverCaminhoUpload } from "@/lib/uploads";
import { ErroDriver } from "./canal";

// MÍDIA DO CANAL (doc 26 §Camada 3 · doc 30 S9 · gaps A3/D28 do doc 28).
// DECISÃO (E3): storage em DISCO LOCAL no pipeline que já existe — data/uploads/whatsapp/
// + GET /api/files/[...path] + ramo novo em podeLerArquivo (doc 29 regra 10: "mídia só via
// UPLOAD_DIR + /api/files"). S3/retenção são decisão de deploy (E5).
// Inbound: URLs de mídia da Meta EXPIRAM em minutos — o webhook baixa na hora (gap A3).
// Validação (D28): whitelist de MIME + teto de 10MB; fora disso a mensagem entra no log
// SEM binário (o texto/caption sobrevive; nada explode).

const SUBPASTA = "whatsapp";
/** Saída (inbox → contato): por AUTOR — whatsapp-out/<usuarioId>/ (review PR #51 P1-2). */
const SUBPASTA_SAIDA = "whatsapp-out";
/** Teto único de mídia do canal (inbound e outbound). Exportado p/ o uploader validar ANTES de materializar o corpo. */
export const MAX_BYTES_MIDIA = 10 * 1024 * 1024;
const MAX_BYTES = MAX_BYTES_MIDIA;

/** MIME normalizado (sem "; codecs=...") → extensão canônica do storage. */
const EXTENSAO_POR_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "audio/ogg": ".ogg",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/webm": ".webm",
  "video/mp4": ".mp4",
  "application/pdf": ".pdf",
};

export function normalizarMime(mime: string | null | undefined): string {
  return (mime ?? "").split(";")[0].trim().toLowerCase();
}

export function extensaoPorMime(mime: string | null | undefined): string | null {
  return EXTENSAO_POR_MIME[normalizarMime(mime)] ?? null;
}

/** Tipo normalizado da mensagem a partir do MIME (enum TipoMensagem). */
export function tipoPorMime(mime: string | null | undefined): TipoMensagem {
  const m = normalizarMime(mime);
  if (m.startsWith("image/")) return "IMAGEM";
  if (m.startsWith("audio/")) return "AUDIO";
  if (m.startsWith("video/")) return "VIDEO";
  if (m === "application/pdf") return "DOCUMENTO";
  return "OUTRO";
}

/**
 * Persiste um binário inbound no storage privado e devolve a URL canônica
 * (`/api/files/whatsapp/<arquivo>`) para gravar em `MensagemWhatsApp.midiaPath`.
 * MIME fora da whitelist ou acima de 10MB → null (mensagem fica sem binário).
 */
export async function salvarMidiaInbound(
  bytes: Buffer,
  mime: string | null | undefined,
): Promise<string | null> {
  const ext = extensaoPorMime(mime);
  if (!ext) return null;
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;

  const dir = path.join(UPLOAD_DIR, SUBPASTA);
  await mkdir(dir, { recursive: true });
  const nome = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
  await writeFile(path.join(dir, nome), bytes);
  return `/api/files/${SUBPASTA}/${nome}`;
}

/**
 * Persiste um binário que o USUÁRIO subiu para ENVIAR pela inbox. Vive em
 * `whatsapp-out/<usuarioId>/` — a posse fica no caminho, e é ela que a action de envio
 * valida (review PR #51 P1-2: sem isso, qualquer URL de /api/files viraria anexo e um
 * comprovante fora do escopo do usuário poderia ser exfiltrado para um contato externo).
 */
export async function salvarMidiaSaida(
  usuarioId: string,
  bytes: Buffer,
  mime: string | null | undefined,
): Promise<string | null> {
  const ext = extensaoPorMime(mime);
  if (!ext) return null;
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;

  const dir = path.join(UPLOAD_DIR, SUBPASTA_SAIDA, usuarioId);
  await mkdir(dir, { recursive: true });
  const nome = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
  await writeFile(path.join(dir, nome), bytes);
  return `/api/files/${SUBPASTA_SAIDA}/${usuarioId}/${nome}`;
}

/**
 * A URL é uma mídia de saída DO PRÓPRIO autor? Checagem canônica por segmentos (não por
 * prefixo de string): rejeita traversal (`..`) que "começaria com" o prefixo certo mas
 * resolveria para arquivo de outro usuário ou de outra pasta.
 */
export function midiaSaidaDoAutor(url: string, autorId: string): boolean {
  const prefixo = "/api/files/";
  if (!url.startsWith(prefixo)) return false;
  const seg = url.slice(prefixo.length).split("/");
  return (
    seg.length === 3 &&
    seg[0] === SUBPASTA_SAIDA &&
    seg[1] === autorId &&
    seg[2].length > 0 &&
    !seg[2].includes("..") &&
    !seg[2].includes("\\")
  );
}

export interface MidiaParaEnvio {
  mime: string;
  nomeArquivo: string;
  dadosBase64: string;
}

/**
 * Lê um arquivo do storage privado a partir da URL canônica `/api/files/...` para o
 * despachante entregar ao driver. Lança ErroDriver com motivo estável (vira FALHOU na
 * intenção + fila humana) quando o caminho é inválido ou o arquivo sumiu.
 * DEFESA EM PROFUNDIDADE (review PR #51 P1-2): só lê de `whatsapp-out/` — mesmo que uma
 * intenção nasça com caminho de comprovante/documento, o despachante não o entrega.
 */
export async function lerMidiaParaEnvio(midiaPath: string): Promise<MidiaParaEnvio> {
  const prefixo = "/api/files/";
  if (!midiaPath.startsWith(prefixo)) throw new ErroDriver("midia_caminho_invalido");
  const segmentos = midiaPath.slice(prefixo.length).split("/").filter(Boolean);
  const caminho = resolverCaminhoUpload(segmentos);
  if (!caminho) throw new ErroDriver("midia_caminho_invalido");
  const baseSaida = path.normalize(path.join(UPLOAD_DIR, SUBPASTA_SAIDA) + path.sep);
  if (!caminho.startsWith(baseSaida)) throw new ErroDriver("midia_fora_do_storage_de_envio");
  const mime = contentTypePorExtensao(caminho);
  if (!mime) throw new ErroDriver("midia_tipo_nao_permitido");
  let bytes: Buffer;
  try {
    bytes = await readFile(caminho);
  } catch {
    throw new ErroDriver("midia_arquivo_ausente", `Mídia não encontrada: ${midiaPath}`);
  }
  return { mime, nomeArquivo: path.basename(caminho), dadosBase64: bytes.toString("base64") };
}

// ---------------------------------------------------------------------------
// Download inbound por driver (chamado pelos WEBHOOKS, antes de gravar o log)
// ---------------------------------------------------------------------------

const GRAPH_BASE = process.env.META_WA_GRAPH_URL ?? "https://graph.facebook.com/v21.0";

/**
 * Baixa a mídia de uma mensagem da Cloud API (2 passos: GET /<media_id> → url efêmera →
 * GET url com o mesmo Bearer). Falha silenciosa → null (mensagem entra sem binário).
 */
export async function baixarMidiaMeta(mediaId: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const token = process.env.META_WA_TOKEN;
  if (!token) return null;
  try {
    const meta = await fetch(`${GRAPH_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meta.ok) return null;
    const info = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number };
    if (!info.url) return null;
    if (info.file_size && info.file_size > MAX_BYTES) return null;

    const arquivo = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!arquivo.ok) return null;
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    return { bytes, mime: info.mime_type ?? arquivo.headers.get("content-type") ?? "" };
  } catch (e) {
    console.error("[whatsapp midia] falha ao baixar da Meta:", e);
    return null;
  }
}

/**
 * Obtém o binário de uma mensagem Baileys via Evolution (o webhook pode já trazer o
 * base64 quando a instância está configurada com `base64: true` — aí nem chamamos a API).
 */
export async function baixarMidiaEvolution(
  instancia: string,
  providerMessageId: string,
  base64DoWebhook?: string | null,
  mimeDoWebhook?: string | null,
): Promise<{ bytes: Buffer; mime: string } | null> {
  try {
    if (base64DoWebhook) {
      const bytes = Buffer.from(base64DoWebhook, "base64");
      if (bytes.byteLength > MAX_BYTES) return null;
      return { bytes, mime: mimeDoWebhook ?? "" };
    }
    const base = process.env.EVOLUTION_URL;
    const apikey = process.env.EVOLUTION_APIKEY;
    if (!base || !apikey) return null;
    const resposta = await fetch(
      `${base.replace(/\/$/, "")}/chat/getBase64FromMediaMessage/${instancia}`,
      {
        method: "POST",
        headers: { apikey, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { key: { id: providerMessageId } }, convertToMp4: false }),
      },
    );
    if (!resposta.ok) return null;
    const json = (await resposta.json()) as { base64?: string; mimetype?: string };
    if (!json.base64) return null;
    const bytes = Buffer.from(json.base64, "base64");
    if (bytes.byteLength > MAX_BYTES) return null;
    return { bytes, mime: json.mimetype ?? mimeDoWebhook ?? "" };
  } catch (e) {
    console.error("[whatsapp midia] falha ao baixar da Evolution:", e);
    return null;
  }
}
