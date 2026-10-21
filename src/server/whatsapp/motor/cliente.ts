import { MAX_BYTES_MIDIA } from "../midia";
import { lerConfigMotor } from "./config";

export type CodigoErroMotor =
  | "SEM_CONFIG"
  | "NAO_ENVIADO"
  | "RESULTADO_INCERTO"
  | "EM_ANDAMENTO"
  | "NAO_AUTORIZADO"
  | "NUMERO_INEXISTENTE"
  | "ACAO_NAO_DISPONIVEL"
  | "LIMITE_RITMO"
  | "INDISPONIVEL"
  | "TIMEOUT"
  | "HTTP";

export class ErroMotor extends Error {
  constructor(
    readonly codigo: CodigoErroMotor,
    readonly status: number,
    readonly motivo?: string,
    readonly providerMessageId?: string,
  ) {
    super(`Motor WhatsApp: ${codigo}${motivo ? ` (${motivo})` : ""}`);
    this.name = "ErroMotor";
  }
}

/** Mensagem exibida ao atendente quando o ritmo do motor recusa o envio. */
export const MENSAGEM_LIMITE_RITMO = "Muitas mensagens em pouco tempo. Tente de novo em instantes.";

export const TIMEOUT_PADRAO_MS = 10_000;
export const TIMEOUT_TEXTO_MS = 15_000;
export const TIMEOUT_MIDIA_MS = 60_000;

export interface InitMotor {
  metodo: "GET" | "PUT" | "POST" | "DELETE";
  json?: unknown;
  form?: FormData;
  timeoutMs?: number;
  cabecalhos?: Record<string, string>;
}

const CODIGOS_INDISPONIVEL = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET"]);

function traduzirFalhaDeRede(e: unknown): ErroMotor {
  const err = e as { name?: string; cause?: { code?: string } } | null;
  if (err?.name === "TimeoutError" || err?.name === "AbortError") return new ErroMotor("TIMEOUT", 0);
  const code = err?.cause?.code;
  if (code && CODIGOS_INDISPONIVEL.has(code)) return new ErroMotor("INDISPONIVEL", 0);
  return new ErroMotor("INDISPONIVEL", 0);
}

async function erroDaResposta(res: Response): Promise<ErroMotor> {
  let corpo: { code?: string; motivo?: string; providerMessageId?: string } = {};
  try {
    corpo = (await res.json()) as typeof corpo;
  } catch {
    corpo = {};
  }
  const { status } = res;
  const motivo = typeof corpo.motivo === "string" ? corpo.motivo : undefined;
  const pid = typeof corpo.providerMessageId === "string" ? corpo.providerMessageId : undefined;
  if (status === 401) return new ErroMotor("NAO_AUTORIZADO", status);
  if (status === 409 && corpo.code === "NAO_ENVIADO") {
    return motivo === "limite_ritmo"
      ? new ErroMotor("LIMITE_RITMO", status, motivo)
      : new ErroMotor("NAO_ENVIADO", status, motivo);
  }
  if (status === 409 && corpo.code === "EM_ANDAMENTO") return new ErroMotor("EM_ANDAMENTO", status, motivo);
  if (corpo.code === "RESULTADO_INCERTO") return new ErroMotor("RESULTADO_INCERTO", status, motivo, pid);
  if (status === 404 && corpo.code === "NUMERO_INEXISTENTE") return new ErroMotor("NUMERO_INEXISTENTE", status, motivo);
  if (status === 403 && corpo.code === "ACAO_NAO_DISPONIVEL") return new ErroMotor("ACAO_NAO_DISPONIVEL", status, motivo);
  return new ErroMotor("HTTP", status, motivo);
}

function montarRequisicao(rota: string, init: { timeoutMs?: number; cabecalhos?: Record<string, string> }) {
  const cfg = lerConfigMotor();
  return {
    url: `${cfg.url}${rota}`,
    headers: { authorization: `Bearer ${cfg.apiKey}`, ...(init.cabecalhos ?? {}) } as Record<string, string>,
    signal: AbortSignal.timeout(init.timeoutMs ?? TIMEOUT_PADRAO_MS),
  };
}

export async function chamarMotor<T>(rota: string, init: InitMotor): Promise<T> {
  const { url, headers, signal } = montarRequisicao(rota, init);
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    headers["content-type"] = "application/json";
  }
  let res: Response;
  try {
    res = await fetch(url, { method: init.metodo, headers, body, signal });
  } catch (e) {
    throw traduzirFalhaDeRede(e);
  }
  if (!res.ok) throw await erroDaResposta(res);
  if (res.status === 204) return undefined as T;
  let texto: string;
  try {
    texto = await res.text();
  } catch (e) {
    throw traduzirFalhaDeRede(e);
  }
  if (!texto) return undefined as T;
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new ErroMotor("HTTP", res.status, "resposta_invalida");
  }
}

export async function baixarDoMotor(
  rota: string,
  timeoutMs: number = TIMEOUT_MIDIA_MS,
): Promise<{ bytes: Buffer; mime: string; tamanho: number }> {
  const { url, headers, signal } = montarRequisicao(rota, { timeoutMs });
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers, signal });
    if (!res.ok) throw await erroDaResposta(res);
    const declarado = Number(res.headers.get("content-length"));
    if (Number.isFinite(declarado) && declarado > MAX_BYTES_MIDIA) {
      await res.body?.cancel().catch(() => undefined);
      throw new ErroMotor("HTTP", 413, "midia_grande_demais");
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_BYTES_MIDIA) throw new ErroMotor("HTTP", 413, "midia_grande_demais");
    const mime = (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim().toLowerCase();
    return { bytes, mime, tamanho: bytes.length };
  } catch (e) {
    if (e instanceof ErroMotor) throw e;
    throw traduzirFalhaDeRede(e);
  }
}
