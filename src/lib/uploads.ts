import path from "path";

export const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".webm": "audio/webm",
  ".mp4": "video/mp4",
};

export function contentTypePorExtensao(nome: string): string | null {
  return CONTENT_TYPES[path.extname(nome).toLowerCase()] ?? null;
}

export function resolverCaminhoUpload(segmentos: string[]): string | null {
  const alvo = path.normalize(path.join(UPLOAD_DIR, ...segmentos));
  const base = path.normalize(UPLOAD_DIR + path.sep);
  if (alvo !== UPLOAD_DIR && !alvo.startsWith(base)) return null;
  return alvo;
}
