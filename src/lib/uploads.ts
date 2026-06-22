import path from "path";

// Diretório de storage PRIVADO de uploads (comprovantes / contratos / documentos).
// Fica FORA de public/ — os arquivos não são servidos estaticamente; só pela rota
// autenticada GET /api/files/[...path]. Versionamento ignorado no .gitignore.
export const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

// Tipos de conteúdo permitidos (espelha a validação do POST /api/upload).
const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export function contentTypePorExtensao(nome: string): string | null {
  return CONTENT_TYPES[path.extname(nome).toLowerCase()] ?? null;
}

// Resolve um caminho de upload com defesa contra path traversal. Retorna o caminho
// absoluto se estiver contido em UPLOAD_DIR; caso contrário, null.
export function resolverCaminhoUpload(segmentos: string[]): string | null {
  const alvo = path.normalize(path.join(UPLOAD_DIR, ...segmentos));
  const base = path.normalize(UPLOAD_DIR + path.sep);
  if (alvo !== UPLOAD_DIR && !alvo.startsWith(base)) return null;
  return alvo;
}
