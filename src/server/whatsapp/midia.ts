import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import type { TipoMensagem } from "@prisma/client";
import { UPLOAD_DIR, contentTypePorExtensao, resolverCaminhoUpload } from "@/lib/uploads";
import { ErroDriver } from "./canal";

const SUBPASTA = "whatsapp";
const SUBPASTA_SAIDA = "whatsapp-out";
export const MAX_BYTES_MIDIA = 10 * 1024 * 1024;
const MAX_BYTES = MAX_BYTES_MIDIA;

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

export function tipoPorMime(mime: string | null | undefined): TipoMensagem {
  const m = normalizarMime(mime);
  if (m.startsWith("image/")) return "IMAGEM";
  if (m.startsWith("audio/")) return "AUDIO";
  if (m.startsWith("video/")) return "VIDEO";
  if (m === "application/pdf") return "DOCUMENTO";
  return "OUTRO";
}

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

export async function descartarMidiaSaida(autorId: string, url: string): Promise<void> {
  if (!midiaSaidaDoAutor(url, autorId)) return;
  const caminho = resolverCaminhoUpload(url.slice("/api/files/".length).split("/"));
  if (caminho) await rm(caminho, { force: true }).catch(() => undefined);
}

export async function midiaSaidaExiste(autorId: string, url: string): Promise<boolean> {
  if (!midiaSaidaDoAutor(url, autorId)) return false;
  const caminho = resolverCaminhoUpload(url.slice("/api/files/".length).split("/"));
  if (!caminho) return false;
  return stat(caminho).then((s) => s.isFile() && s.size > 0, () => false);
}

export async function copiarMidiaParaSaida(autorId: string, midiaPath: string): Promise<string | null> {
  return copiarArquivoParaSaida(autorId, midiaPath, (segmentos) => segmentos[0] === SUBPASTA || segmentos[0] === SUBPASTA_SAIDA);
}

export async function copiarDocumentoParaSaida(autorId: string, url: string): Promise<string | null> {
  return copiarArquivoParaSaida(autorId, url, () => true);
}

async function copiarArquivoParaSaida(autorId: string, url: string, origemAceita: (segmentos: string[]) => boolean): Promise<string | null> {
  const prefixo = "/api/files/";
  if (!url.startsWith(prefixo)) return null;
  const segmentos = url.slice(prefixo.length).split("/").filter(Boolean);
  if (!segmentos.length || !origemAceita(segmentos)) return null;
  const caminho = resolverCaminhoUpload(segmentos);
  if (!caminho) return null;
  const mime = contentTypePorExtensao(caminho);
  if (!mime) return null;
  let bytes: Buffer;
  try {
    bytes = await readFile(caminho);
  } catch {
    return null;
  }
  return salvarMidiaSaida(autorId, bytes, mime);
}

export interface MidiaParaEnvio {
  mime: string;
  nomeArquivo: string;
  dadosBase64: string;
}

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

export async function baixarMidiaMotor(
  numeroRef: string,
  mensagemIdMotor: string,
): Promise<{ bytes: Buffer; mime: string } | null> {
  const { baixarDoMotor, ErroMotor } = await import("./motor/cliente");
  try {
    const { bytes, mime } = await baixarDoMotor(
      `/v1/numeros/${encodeURIComponent(numeroRef)}/midia/${encodeURIComponent(mensagemIdMotor)}`,
    );
    return { bytes, mime };
  } catch (e) {
    if (e instanceof ErroMotor) return null;
    throw e;
  }
}
