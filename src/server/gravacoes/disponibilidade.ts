/**
 * Preflight do arquivo oficial antes de uma publicação ou retomada. A leitura é curta e
 * descartada: ela prova que o vídeo institucional continua acessível sem
 * transformar o stream em um download no servidor.
 */
import { obterDriveOrganizacaoId, obterTokenDrive } from "./credenciais";
import { abrirVideoDriveOrganizacional, ErroVideoDrive, type EntradaVideoDrive, type VideoDrive } from "./drive";

const TEMPO_LIMITE_PADRAO_MS = 10_000;
const TEMPO_LIMPEZA_MS = 250;

type AbrirVideo = (entrada: EntradaVideoDrive) => Promise<VideoDrive>;

export type DependenciasDisponibilidadeGravacao = {
  abrirVideo?: AbrirVideo;
  obterDriveId?: () => string;
  obterToken?: () => Promise<string>;
  tempoLimiteMs?: number;
};

function falhaDisponibilidade(): never {
  throw new ErroVideoDrive();
}

function corridaComAbort<T>(promessa: Promise<T>, sinal: AbortSignal) {
  let remover: (() => void) | undefined;
  const abortada = new Promise<never>((_, rejeitar) => {
    const abortar = () => rejeitar(new Error("preflight expirado"));
    if (sinal.aborted) {
      abortar();
      return;
    }
    sinal.addEventListener("abort", abortar, { once: true });
    remover = () => sinal.removeEventListener("abort", abortar);
  });
  return Promise.race([promessa, abortada]).finally(() => remover?.());
}

async function cancelarLeitor(leitor: ReadableStreamDefaultReader<Uint8Array>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const cancelamento = leitor.cancel().catch(() => undefined);
    await Promise.race([
      cancelamento,
      new Promise<void>((resolver) => { timeout = setTimeout(resolver, TEMPO_LIMPEZA_MS); }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    leitor.releaseLock();
  }
}

/**
 * Confere metadata, pertencimento ao Drive institucional e a leitura de um
 * único byte. O prazo limita token, metadata, mídia e primeiro chunk. Caso a
 * abertura termine depois do timeout, o stream tardio também é descartado.
 */
export async function verificarDisponibilidadeGravacaoDrive(
  arquivoOficialId: string,
  dependencias: DependenciasDisponibilidadeGravacao = {},
): Promise<void> {
  const tempoLimiteMs = dependencias.tempoLimiteMs ?? TEMPO_LIMITE_PADRAO_MS;
  if (!Number.isSafeInteger(tempoLimiteMs) || tempoLimiteMs < 1) falhaDisponibilidade();

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), tempoLimiteMs);
  let leitor: ReadableStreamDefaultReader<Uint8Array> | null = null;
  try {
    const abertura = (dependencias.abrirVideo ?? abrirVideoDriveOrganizacional)({
      fileId: arquivoOficialId,
      driveIdOrganizacao: (dependencias.obterDriveId ?? obterDriveOrganizacaoId)(),
      token: dependencias.obterToken ?? obterTokenDrive,
      range: "bytes=0-0",
      signal: controlador.signal,
    });
    // Alguns clientes de token não obedecem AbortSignal. Se ainda assim
    // devolverem uma resposta tardia, não deixamos o corpo aberto.
    void abertura.then((video) => {
      if (controlador.signal.aborted) void video.body.cancel().catch(() => undefined);
    }).catch(() => undefined);
    const video = await corridaComAbort(abertura, controlador.signal);
    leitor = video.body.getReader();
    const chunk = await corridaComAbort(leitor.read(), controlador.signal);
    if (chunk.done || !chunk.value || chunk.value.byteLength < 1) falhaDisponibilidade();
  } catch {
    // Credenciais, metadados, acesso e timeout têm a mesma superfície segura.
    falhaDisponibilidade();
  } finally {
    clearTimeout(timeout);
    if (leitor) await cancelarLeitor(leitor);
  }
}
