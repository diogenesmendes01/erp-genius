/**
 * Adaptador server-only para bytes de vídeo hospedados no Drive da organização.
 * Ele recebe apenas um ID interno já autorizado pelo chamador; não conhece
 * sessão HTTP, URLs externas persistidas nem expõe o bearer token.
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const ERRO_DISPONIBILIDADE = "Vídeo indisponível no repositório institucional.";
const ID_INTERNO = /^[A-Za-z0-9_-]{3,500}$/;
const MAX_DIGITOS_RANGE = 19;

export class ErroVideoDrive extends Error {
  constructor() { super(ERRO_DISPONIBILIDADE); }
}

export type BuscarTokenDrive = () => Promise<string>;
export type FetchDrive = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type EntradaVideoDrive = {
  fileId: string;
  driveIdOrganizacao: string;
  token: BuscarTokenDrive;
  range?: string | null;
  signal?: AbortSignal;
  fetch?: FetchDrive;
};

export type VideoDrive = {
  status: 200 | 206;
  body: ReadableStream<Uint8Array>;
  headers: Headers;
};

type MetadadosDrive = {
  id?: unknown;
  driveId?: unknown;
  mimeType?: unknown;
  trashed?: unknown;
  capabilities?: { canDownload?: unknown } | null;
};

type RangeUnico = { inicio?: bigint; fim?: bigint; sufixo?: bigint; valor: string };

export function validarRange(range: string | null | undefined): RangeUnico | null {
  if (range == null || range.trim() === "") return null;
  const valor = range.trim();
  const partes = /^bytes=(\d*)-(\d*)$/.exec(valor);
  if (!partes || (!partes[1] && !partes[2])) throw new ErroVideoDrive();
  if (partes[1].length > MAX_DIGITOS_RANGE || partes[2].length > MAX_DIGITOS_RANGE) throw new ErroVideoDrive();
  const inicio = partes[1] ? BigInt(partes[1]) : undefined;
  const fim = partes[2] ? BigInt(partes[2]) : undefined;
  if (inicio != null && fim != null && inicio > fim) throw new ErroVideoDrive();
  if (inicio == null && fim === 0n) throw new ErroVideoDrive();
  return { inicio, fim, sufixo: inicio == null ? fim : undefined, valor: `bytes=${partes[1]}-${partes[2]}` };
}

function urlDrive(fileId: string, media: boolean) {
  const query = media
    ? "alt=media&supportsAllDrives=true"
    : "supportsAllDrives=true&fields=id%2CdriveId%2CmimeType%2Ctrashed%2Ccapabilities%28canDownload%29";
  return `${DRIVE_API}/${encodeURIComponent(fileId)}?${query}`;
}

async function tokenSeguro(obter: BuscarTokenDrive) {
  try {
    const token = await obter();
    if (!token || token.length > 16_384) throw new Error("token inválido");
    return token;
  } catch {
    throw new ErroVideoDrive();
  }
}

async function requisitar(
  fetchDrive: FetchDrive,
  url: string,
  token: string,
  signal: AbortSignal | undefined,
  opcoes: { aceitar: string; range?: RangeUnico | null },
) {
  try {
    const headers = new Headers({ Authorization: `Bearer ${token}`, Accept: opcoes.aceitar });
    if (opcoes.range) headers.set("Range", opcoes.range.valor);
    return await fetchDrive(url, { headers, redirect: "error", cache: "no-store", signal });
  } catch {
    throw new ErroVideoDrive();
  }
}

async function descartar(resposta: Response) {
  try {
    await resposta.body?.cancel();
  } catch {
    // A resposta pode já ter sido lida ou cancelada pelo runtime.
  }
}

function validarContentRange(resposta: Response, range: RangeUnico | null) {
  if (resposta.status !== 206) return;
  const valor = resposta.headers.get("content-range");
  const partes = valor && /^bytes (\d+)-(\d+)\/(\d+)$/.exec(valor);
  if (!partes || partes[1].length > MAX_DIGITOS_RANGE || partes[2].length > MAX_DIGITOS_RANGE || partes[3].length > MAX_DIGITOS_RANGE) {
    throw new ErroVideoDrive();
  }
  const inicio = BigInt(partes[1]);
  const fim = BigInt(partes[2]);
  const total = BigInt(partes[3]);
  if (inicio > fim || fim >= total) throw new ErroVideoDrive();
  if (range?.inicio != null && inicio !== range.inicio) throw new ErroVideoDrive();
  if (range?.inicio != null && range.fim != null && fim > range.fim) throw new ErroVideoDrive();
  if (range?.sufixo != null) {
    const inicioEsperado = range.sufixo >= total ? 0n : total - range.sufixo;
    if (inicio !== inicioEsperado || fim !== total - 1n) throw new ErroVideoDrive();
  }
  const comprimento = resposta.headers.get("content-length");
  if (comprimento != null && (!/^\d+$/.test(comprimento) || BigInt(comprimento) !== fim - inicio + 1n)) throw new ErroVideoDrive();
}

export function cabecalhosVideo(resposta: Response, mimeType: string, range: RangeUnico | null) {
  const headers = new Headers();
  const tipo = resposta.headers.get("content-type") ?? mimeType;
  if (!tipo.toLowerCase().startsWith("video/")) throw new ErroVideoDrive();
  validarContentRange(resposta, range);
  headers.set("Content-Type", tipo);
  for (const nome of ["content-range", "content-length"] as const) {
    const valor = resposta.headers.get(nome);
    if (valor) headers.set(nome, valor);
  }
  return headers;
}

/**
 * Abre o stream sem materializar o vídeo em memória. A chamada de metadata
 * bloqueia arquivo apagado, de outro drive, não baixável ou que não seja vídeo
 * antes de `alt=media` ser solicitado.
 */
async function conferirMetadados(entrada: Omit<EntradaVideoDrive, "range">, fetchDrive: FetchDrive, token: string) {
  const metadadosResposta = await requisitar(fetchDrive, urlDrive(entrada.fileId, false), token, entrada.signal, { aceitar: "application/json" });
  if (!metadadosResposta.ok) {
    await descartar(metadadosResposta);
    throw new ErroVideoDrive();
  }
  let metadados: MetadadosDrive;
  try { metadados = await metadadosResposta.json() as MetadadosDrive; }
  catch { throw new ErroVideoDrive(); }
  if (!metadados || typeof metadados !== "object" || Array.isArray(metadados)
    || metadados.id !== entrada.fileId || metadados.driveId !== entrada.driveIdOrganizacao || metadados.trashed !== false
    || metadados.capabilities?.canDownload !== true || typeof metadados.mimeType !== "string" || !metadados.mimeType.toLowerCase().startsWith("video/")) {
    throw new ErroVideoDrive();
  }
  return { fileId: entrada.fileId, driveId: entrada.driveIdOrganizacao, mimeType: metadados.mimeType };
}

/** Confere a fonte para publicação sem baixar o vídeo nem conceder acesso ao aluno.
 * O resultado vale para esta consulta; reprodução deve conferir novamente a fonte.
 */
export async function conferirVideoDriveOrganizacional(entrada: Omit<EntradaVideoDrive, "range">) {
  if (!ID_INTERNO.test(entrada.fileId) || !ID_INTERNO.test(entrada.driveIdOrganizacao)) throw new ErroVideoDrive();
  return conferirMetadados(entrada, entrada.fetch ?? fetch, await tokenSeguro(entrada.token));
}

export async function abrirVideoDriveOrganizacional(entrada: EntradaVideoDrive): Promise<VideoDrive> {
  if (!ID_INTERNO.test(entrada.fileId) || !ID_INTERNO.test(entrada.driveIdOrganizacao)) throw new ErroVideoDrive();
  const range = validarRange(entrada.range);
  const fetchDrive = entrada.fetch ?? fetch;
  const token = await tokenSeguro(entrada.token);
  const metadados = await conferirMetadados(entrada, fetchDrive, token);
  const bytes = await requisitar(fetchDrive, urlDrive(entrada.fileId, true), token, entrada.signal, { aceitar: "video/*", range });
  if (!bytes.body || (range ? bytes.status !== 206 : ![200, 206].includes(bytes.status))) {
    await descartar(bytes);
    throw new ErroVideoDrive();
  }
  try {
    return { status: bytes.status as 200 | 206, body: bytes.body, headers: cabecalhosVideo(bytes, metadados.mimeType, range) };
  } catch (erro) {
    await descartar(bytes);
    throw erro;
  }
}
