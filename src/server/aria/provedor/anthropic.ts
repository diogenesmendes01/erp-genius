import { CACHE_CONTROL_SISTEMA, modeloPermitido } from "./custo";
import { ErroProvedorIA, type ModelosIA, type PedidoIA, type ProvedorIA, type RespostaIA } from "./tipos";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const MODELO_COM_RESERVA = "claude-sonnet-5-5";
const BETA_RESERVA = "server-side-fallback-2026-07-01";

interface RespostaBruta {
  stop_reason?: string | null;
  content?: { type: string; text?: string }[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
}

interface ErroAPI {
  type?: string;
  message?: string;
  error?: { type?: string; message?: string };
}

export interface ClienteMensagens {
  beta: { messages: { create(req: Record<string, unknown>): Promise<unknown> } };
}

class AnthropicHTTPClient implements ClienteMensagens {
  private readonly apiKey: string;

  constructor(config: { apiKey?: string; timeout?: number; maxRetries?: number }) {
    if (!config.apiKey) {
      throw new Error("ANTHROPIC_API_KEY não configurada");
    }
    this.apiKey = config.apiKey;
  }

  beta = {
    messages: {
      create: async (req: Record<string, unknown>): Promise<RespostaBruta> => {
        return this.chamarComRetry(req, 0);
      },
    },
  };

  private async chamarComRetry(req: Record<string, unknown>, tentativa: number): Promise<RespostaBruta> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify(req),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const erro: ErroAPI = await response.json().catch(() => ({}));
        const mensagem = erro.error?.message || erro.message || response.statusText;

        if (response.status === 429 && tentativa < MAX_RETRIES) {
          await this.aguardar(Math.pow(2, tentativa) * 1000);
          return this.chamarComRetry(req, tentativa + 1);
        }

        if (response.status >= 500 && tentativa < MAX_RETRIES) {
          await this.aguardar(Math.pow(2, tentativa) * 1000);
          return this.chamarComRetry(req, tentativa + 1);
        }

        throw { status: response.status, message: mensagem, isAPIError: true };
      }

      return (await response.json()) as RespostaBruta;
    } catch (e: unknown) {
      clearTimeout(timeoutId);

      if (e && typeof e === "object" && "name" in e && e.name === "AbortError") {
        throw { isTimeout: true, message: "Request timeout" };
      }

      if (
        e &&
        typeof e === "object" &&
        "cause" in e &&
        e.cause &&
        typeof e.cause === "object" &&
        "code" in e.cause
      ) {
        const code = (e.cause as { code?: string }).code;
        if ((code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") && tentativa < MAX_RETRIES) {
          await this.aguardar(Math.pow(2, tentativa) * 1000);
          return this.chamarComRetry(req, tentativa + 1);
        }
        throw { isConnectionError: true, message: `Network error: ${code}` };
      }

      throw e;
    }
  }

  private aguardar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function clientePadrao(): ClienteMensagens {
  return new AnthropicHTTPClient({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });
}

function traduzirErro(e: unknown): ErroProvedorIA {
  if (e instanceof ErroProvedorIA) return e;

  if (e && typeof e === "object") {
    if ("status" in e && "isAPIError" in e) {
      const status = (e as { status: number }).status;
      const message = (e as { message?: string }).message || "API Error";
      if (status === 429) return new ErroProvedorIA("429", message);
      if (status === 401 || status === 403) return new ErroProvedorIA("401", message);
      return new ErroProvedorIA(String(status), message);
    }

    if ("isTimeout" in e) {
      const message = (e as { message?: string }).message || "Request timeout";
      return new ErroProvedorIA("TIMEOUT", message);
    }

    if ("isConnectionError" in e) {
      const message = (e as { message?: string }).message || "Connection error";
      return new ErroProvedorIA("CONEXAO", message);
    }
  }

  return new ErroProvedorIA("DESCONHECIDO", e instanceof Error ? e.message : String(e));
}

function montarMensagens(p: PedidoIA): Record<string, unknown>[] {
  return p.mensagens.map((m, i) => {
    const ultima = i === p.mensagens.length - 1;
    const papel = m.papel === "usuario" ? "user" : "assistant";
    if (ultima && p.pdfBase64) {
      return {
        role: papel,
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.pdfBase64 } },
          { type: "text", text: m.texto },
        ],
      };
    }
    return { role: papel, content: m.texto };
  });
}

export function criarProvedorAnthropic(cliente: ClienteMensagens, modelos: ModelosIA): ProvedorIA {
  return {
    nome: "anthropic",
    async gerar(p: PedidoIA): Promise<RespostaIA> {
      const modelo = p.tarefa === "classificacao" ? modelos.classificacao : modelos.conversa;
      if (!modeloPermitido(modelo)) {
        throw new ErroProvedorIA("MODELO_NAO_PERMITIDO", `Modelo fora de MODELOS_PERMITIDOS: ${modelo}`);
      }
      const outputConfig: Record<string, unknown> = { effort: "low" };
      if (p.esquemaSaida) outputConfig.format = { type: "json_schema", schema: p.esquemaSaida };
      const req: Record<string, unknown> = {
        model: modelo,
        max_tokens: p.maxTokens,
        system: [{ type: "text", text: p.sistema, cache_control: CACHE_CONTROL_SISTEMA }],
        messages: montarMensagens(p),
        output_config: outputConfig,
      };
      if (modelo === MODELO_COM_RESERVA) {
        req.betas = [BETA_RESERVA];
        req.fallbacks = "default";
      }
      const inicio = Date.now();
      let r: RespostaBruta;
      try {
        r = (await cliente.beta.messages.create(req)) as RespostaBruta;
      } catch (e) {
        throw traduzirErro(e);
      }
      const recusa = r.stop_reason === "refusal";
      const texto = recusa
        ? ""
        : (r.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
      return {
        texto,
        modelo,
        provedor: "anthropic",
        recusa,
        tokensEntrada: r.usage?.input_tokens ?? 0,
        tokensSaida: r.usage?.output_tokens ?? 0,
        tokensCache: r.usage?.cache_read_input_tokens ?? 0,
        tokensEscritaCache: r.usage?.cache_creation_input_tokens ?? 0,
        latenciaMs: Date.now() - inicio,
      };
    },
  };
}
