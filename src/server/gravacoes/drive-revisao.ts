import { ErroVideoDrive, type BuscarTokenDrive, type FetchDrive } from "./drive";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const ID_INTERNO = /^[A-Za-z0-9_-]{3,500}$/;
const MD5 = /^[a-f0-9]{32}$/i;
const TEMPO_LIMITE_PADRAO_MS = 10_000;

export type EntradaRevisaoDrive = {
  fileId: string;
  driveIdOrganizacao: string;
  token: BuscarTokenDrive;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetch?: FetchDrive;
};

export type RevisaoDriveFixada = {
  fileId: string;
  driveId: string;
  revisionId: string;
  md5Checksum: string;
  size: string;
  mimeType: string;
};

// Alias transitório para os chamadores que começaram a integrar o adaptador.
export type RevisaoDriveFixa = RevisaoDriveFixada;

type MetadataArquivo = {
  id?: unknown;
  driveId?: unknown;
  headRevisionId?: unknown;
  mimeType?: unknown;
  trashed?: unknown;
  capabilities?: { canDownload?: unknown } | null;
};

type MetadataRevisao = {
  id?: unknown;
  keepForever?: unknown;
  md5Checksum?: unknown;
  size?: unknown;
  mimeType?: unknown;
};

function urlArquivo(fileId: string) {
  return `${DRIVE_API}/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id%2CdriveId%2CheadRevisionId%2CmimeType%2Ctrashed%2Ccapabilities%28canDownload%29`;
}

function urlRevisao(fileId: string, revisionId: string) {
  return `${DRIVE_API}/${encodeURIComponent(fileId)}/revisions/${encodeURIComponent(revisionId)}?fields=id%2CkeepForever%2Cmd5Checksum%2Csize%2CmimeType`;
}

async function descartar(resposta: Response) {
  try { await resposta.body?.cancel(); } catch { /* resposta já consumida */ }
}

export async function aguardarComAbort<T>(signal: AbortSignal, iniciar: () => Promise<T>, aoTardar?: (valor: T) => void) {
  if (signal.aborted) throw new ErroVideoDrive();
  let remover: (() => void) | undefined;
  const abortada = new Promise<never>((_, rejeitar) => {
    const abortar = () => rejeitar(new ErroVideoDrive());
    signal.addEventListener("abort", abortar, { once: true });
    remover = () => signal.removeEventListener("abort", abortar);
  });
  let operacao: Promise<T>;
  try {
    operacao = iniciar();
  } catch {
    remover?.();
    throw new ErroVideoDrive();
  }
  // Um adaptador injetado pode ignorar o signal. Se ele retornar tarde, o
  // corpo não permanece aberto depois que o prazo já invalidou a operação.
  void operacao.then((valor) => { if (signal.aborted) aoTardar?.(valor); }).catch(() => undefined);
  try {
    return await Promise.race([operacao, abortada]);
  } finally {
    remover?.();
  }
}

async function obterTokenSeguro(obter: BuscarTokenDrive, signal: AbortSignal) {
  try {
    const token = await aguardarComAbort(signal, obter);
    if (!token || token.length > 16_384) throw new Error("token inválido");
    return token;
  } catch {
    throw new ErroVideoDrive();
  }
}

export function sinalComPrazo(sinalExterno: AbortSignal | undefined, timeoutMs: number) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new ErroVideoDrive();
  const controlador = new AbortController();
  const abortar = () => controlador.abort();
  if (sinalExterno?.aborted) abortar();
  else sinalExterno?.addEventListener("abort", abortar, { once: true });
  const temporizador = setTimeout(abortar, timeoutMs);
  return {
    signal: controlador.signal,
    encerrar() {
      clearTimeout(temporizador);
      sinalExterno?.removeEventListener("abort", abortar);
    },
  };
}

async function requisitar(fetchDrive: FetchDrive, url: string, token: string, signal: AbortSignal, init: RequestInit = {}) {
  try {
    const resposta = await aguardarComAbort(signal, () => fetchDrive(url, {
      ...init,
      headers: new Headers({ Authorization: `Bearer ${token}`, Accept: "application/json", ...(init.headers ?? {}) }),
      redirect: "error",
      cache: "no-store",
      signal,
    }), (tardia) => { void descartar(tardia); });
    if (!resposta.ok) {
      await descartar(resposta);
      throw new Error("status inválido");
    }
    return resposta;
  } catch {
    throw new ErroVideoDrive();
  }
}

async function jsonSeguro<T>(resposta: Response, signal: AbortSignal): Promise<T> {
  try {
    return await aguardarComAbort(signal, () => resposta.json() as Promise<T>, () => { void descartar(resposta); });
  } catch {
    throw new ErroVideoDrive();
  }
}

function validarArquivo(metadata: MetadataArquivo, entrada: Pick<EntradaRevisaoDrive, "fileId" | "driveIdOrganizacao">, exigirHead: true): { revisionId: string; mimeType: string };
function validarArquivo(metadata: MetadataArquivo, entrada: Pick<EntradaRevisaoDrive, "fileId" | "driveIdOrganizacao">, exigirHead: false): { mimeType: string };
function validarArquivo(metadata: MetadataArquivo, entrada: Pick<EntradaRevisaoDrive, "fileId" | "driveIdOrganizacao">, exigirHead: boolean) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)
    || metadata.id !== entrada.fileId || metadata.driveId !== entrada.driveIdOrganizacao
    || metadata.trashed !== false || metadata.capabilities?.canDownload !== true
    || typeof metadata.mimeType !== "string" || !metadata.mimeType.toLowerCase().startsWith("video/")) {
    throw new ErroVideoDrive();
  }
  if (exigirHead && (typeof metadata.headRevisionId !== "string" || !ID_INTERNO.test(metadata.headRevisionId))) throw new ErroVideoDrive();
  return exigirHead ? { revisionId: metadata.headRevisionId as string, mimeType: metadata.mimeType } : { mimeType: metadata.mimeType };
}

function validarRevisao(metadata: MetadataRevisao, revisionId: string, mimeTypeArquivo: string | undefined, exigirPermanente: boolean): RevisaoDriveFixada {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)
    || metadata.id !== revisionId || (exigirPermanente && metadata.keepForever !== true)
    || typeof metadata.md5Checksum !== "string" || !MD5.test(metadata.md5Checksum)
    || typeof metadata.size !== "string" || !/^\d{1,19}$/.test(metadata.size) || BigInt(metadata.size) < 1n
    || typeof metadata.mimeType !== "string" || (mimeTypeArquivo != null && metadata.mimeType !== mimeTypeArquivo) || !metadata.mimeType.toLowerCase().startsWith("video/")) {
    throw new ErroVideoDrive();
  }
  return { fileId: "", driveId: "", revisionId, md5Checksum: metadata.md5Checksum, size: metadata.size, mimeType: metadata.mimeType };
}

/**
 * Captura a revisão de cabeça atual, torna-a permanente e confirma a mesma
 * identidade. A chamada não baixa bytes e não infere uma revisão diferente.
 */
export async function fixarRevisaoDriveOrganizacional(entrada: EntradaRevisaoDrive): Promise<RevisaoDriveFixada> {
  if (!ID_INTERNO.test(entrada.fileId) || !ID_INTERNO.test(entrada.driveIdOrganizacao)) throw new ErroVideoDrive();
  const prazo = sinalComPrazo(entrada.signal, entrada.timeoutMs ?? TEMPO_LIMITE_PADRAO_MS);
  try {
    const token = await obterTokenSeguro(entrada.token, prazo.signal);
    const fetchDrive = entrada.fetch ?? fetch;
    const arquivo = validarArquivo(await jsonSeguro<MetadataArquivo>(await requisitar(fetchDrive, urlArquivo(entrada.fileId), token, prazo.signal), prazo.signal), entrada, true);
    const primeira = validarRevisao(await jsonSeguro<MetadataRevisao>(await requisitar(fetchDrive, urlRevisao(entrada.fileId, arquivo.revisionId), token, prazo.signal), prazo.signal), arquivo.revisionId, arquivo.mimeType, false);
    await descartar(await requisitar(fetchDrive, urlRevisao(entrada.fileId, arquivo.revisionId), token, prazo.signal, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keepForever: true }),
    }));
    const confirmada = validarRevisao(await jsonSeguro<MetadataRevisao>(await requisitar(fetchDrive, urlRevisao(entrada.fileId, arquivo.revisionId), token, prazo.signal), prazo.signal), arquivo.revisionId, arquivo.mimeType, true);
    if (confirmada.md5Checksum !== primeira.md5Checksum || confirmada.size !== primeira.size || confirmada.mimeType !== primeira.mimeType) throw new ErroVideoDrive();
    return { ...confirmada, fileId: entrada.fileId, driveId: entrada.driveIdOrganizacao };
  } catch (erro) {
    if (erro instanceof ErroVideoDrive) throw erro;
    throw new ErroVideoDrive();
  } finally {
    prazo.encerrar();
  }
}

/**
 * Relê a fonte persistida para reprodução. Uma cabeça nova do mesmo arquivo
 * não substitui a revisão fixa: somente a revisão armazenada é aceita.
 */
export async function consultarRevisaoDriveFixada(entrada: {
  fonte: RevisaoDriveFixada;
  token: BuscarTokenDrive;
  fetch?: FetchDrive;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<RevisaoDriveFixada> {
  const { fonte } = entrada;
  if (!ID_INTERNO.test(fonte.fileId) || !ID_INTERNO.test(fonte.driveId) || !ID_INTERNO.test(fonte.revisionId)
    || !MD5.test(fonte.md5Checksum) || !/^\d{1,19}$/.test(fonte.size) || BigInt(fonte.size) < 1n
    || !fonte.mimeType.toLowerCase().startsWith("video/")) throw new ErroVideoDrive();
  const prazo = sinalComPrazo(entrada.signal, entrada.timeoutMs ?? TEMPO_LIMITE_PADRAO_MS);
  try {
    const token = await obterTokenSeguro(entrada.token, prazo.signal);
    const fetchDrive = entrada.fetch ?? fetch;
    // A cabeça pode ter sido substituída depois da publicação. A segurança da
    // leitura vem da revisão fixa, cuja MIME é comparada à fonte persistida.
    validarArquivo(await jsonSeguro<MetadataArquivo>(await requisitar(fetchDrive, urlArquivo(fonte.fileId), token, prazo.signal), prazo.signal), { fileId: fonte.fileId, driveIdOrganizacao: fonte.driveId }, false);
    const revisao = validarRevisao(await jsonSeguro<MetadataRevisao>(await requisitar(fetchDrive, urlRevisao(fonte.fileId, fonte.revisionId), token, prazo.signal), prazo.signal), fonte.revisionId, undefined, true);
    if (revisao.md5Checksum !== fonte.md5Checksum || revisao.size !== fonte.size || revisao.mimeType !== fonte.mimeType) throw new ErroVideoDrive();
    return fonte;
  } catch (erro) {
    if (erro instanceof ErroVideoDrive) throw erro;
    throw new ErroVideoDrive();
  } finally {
    prazo.encerrar();
  }
}
