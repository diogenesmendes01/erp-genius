import Anthropic from "@anthropic-ai/sdk";
import { ErroProvedorIA, type ModelosIA, type PedidoIA, type ProvedorIA, type RespostaIA } from "./tipos";

// Porta mínima do SDK: o SDK 0.131.0 não tipa os campos de reserva/output_config
// de forma estável, então o pedido é montado como Record local.
export interface ClienteMensagens {
  beta: { messages: { create(req: Record<string, unknown>): Promise<unknown> } };
}

const MODELO_COM_RESERVA = "claude-sonnet-5-5";
const BETA_RESERVA = "server-side-fallback-2026-07-01";

export function clientePadrao(): ClienteMensagens {
  return new Anthropic({ timeout: 30_000, maxRetries: 2 }) as unknown as ClienteMensagens;
}

interface RespostaBruta {
  stop_reason?: string | null;
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null };
}

function traduzirErro(e: unknown): ErroProvedorIA {
  if (e instanceof ErroProvedorIA) return e;
  if (e instanceof Anthropic.RateLimitError) return new ErroProvedorIA("429", e.message);
  if (e instanceof Anthropic.AuthenticationError) return new ErroProvedorIA("401", e.message);
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new ErroProvedorIA("TIMEOUT", e.message);
  if (e instanceof Anthropic.APIConnectionError) return new ErroProvedorIA("CONEXAO", e.message);
  if (e instanceof Anthropic.APIError) return new ErroProvedorIA(String(e.status), e.message);
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
      const outputConfig: Record<string, unknown> = { effort: "low" };
      if (p.esquemaSaida) outputConfig.format = { type: "json_schema", schema: p.esquemaSaida };
      const req: Record<string, unknown> = {
        model: modelo,
        max_tokens: p.maxTokens,
        system: [{ type: "text", text: p.sistema, cache_control: { type: "ephemeral" } }],
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
        latenciaMs: Date.now() - inicio,
      };
    },
  };
}
