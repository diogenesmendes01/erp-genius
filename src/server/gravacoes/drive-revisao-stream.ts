import { cabecalhosVideo, validarRange, ErroVideoDrive, type BuscarTokenDrive, type FetchDrive, type VideoDrive } from "./drive";
import { consultarRevisaoDriveFixada, aguardarComAbort, sinalComPrazo, type RevisaoDriveFixa } from "./drive-revisao";

export type EntradaStreamRevisao = {
  fonte: RevisaoDriveFixa;
  token: BuscarTokenDrive;
  fetch?: FetchDrive;
  range?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
};

/** Nunca usa files.get alt=media: todos os bytes pertencem à revisão persistida. */
export async function abrirVideoRevisaoDrive(entrada: EntradaStreamRevisao): Promise<VideoDrive> {
  let resposta: Response | undefined;
  const prazo = sinalComPrazo(entrada.signal, entrada.timeoutMs ?? 10_000);
  try {
    const range = validarRange(entrada.range);
    const token = await aguardarComAbort(prazo.signal, entrada.token);
    if (!token || token.length > 16_384 || entrada.signal?.aborted) throw new ErroVideoDrive();
    const fetchDrive = entrada.fetch ?? fetch;
    await consultarRevisaoDriveFixada({ fonte: entrada.fonte, token: async () => token, fetch: fetchDrive, signal: prazo.signal });
    const headers = new Headers({ Authorization: `Bearer ${token}`, Accept: "video/*" });
    if (range) headers.set("Range", range.valor);
    const fonte = entrada.fonte;
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fonte.fileId)}/revisions/${encodeURIComponent(fonte.revisionId)}?alt=media`;
    resposta = await aguardarComAbort(prazo.signal, () => fetchDrive(url, { headers, redirect: "error", cache: "no-store", signal: prazo.signal }), tardia => { void tardia.body?.cancel().catch(() => undefined); });
    if (!resposta.body || resposta.status !== (range ? 206 : 200)) throw new ErroVideoDrive();
    const seguros = cabecalhosVideo(resposta, fonte.mimeType, range);
    if (seguros.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== fonte.mimeType.toLowerCase()) throw new ErroVideoDrive();
    if (range) {
      const total = seguros.get("Content-Range")?.split("/")[1];
      if (total == null || BigInt(total) !== BigInt(fonte.size)) throw new ErroVideoDrive();
    } else {
      if (resposta.headers.has("content-range")) throw new ErroVideoDrive();
      const tamanho = seguros.get("Content-Length");
      if (tamanho != null && (!/^\d+$/.test(tamanho) || BigInt(tamanho) !== BigInt(fonte.size))) throw new ErroVideoDrive();
    }
    return { status: resposta.status as 200 | 206, body: resposta.body, headers: seguros };
  } catch {
    try { await resposta?.body?.cancel(); } catch { /* Não expor erro do provedor. */ }
    throw new ErroVideoDrive();
  } finally {
    prazo.encerrar();
  }
}
