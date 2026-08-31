import { EtapaLead, Segmento, Temperatura } from "@prisma/client";
import type { AnaliseLead, ContextoAnalise, DriverIA } from "./tipos";

// DRIVER CLAUDE (Anthropic Messages API) — usado quando ANTHROPIC_API_KEY está no env.
// SÓ-LEITURA por construção: a única saída é um JSON de análise que vira SUGESTÃO
// pendente de decisão humana. Falha de rede/parse NUNCA derruba o fluxo chamador — o
// orquestrador trata o erro e simplesmente não gera sugestões naquele tick.

const API_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 30_000;

function modelo(): string {
  return process.env.IA_MODELO ?? "claude-sonnet-5";
}

const SYSTEM = `Você é o copiloto comercial de uma escola de idiomas online. Analise a conversa de WhatsApp entre a escola e um lead e produza APENAS um JSON válido (sem markdown, sem texto fora do JSON) com esta forma exata:
{
  "resumo": { "interesse": string|null, "objetivo": string|null, "urgencia": string|null, "orcamento": string|null, "objecao": string|null, "proximaAcao": string|null } | null,
  "temperatura": "QUENTE"|"MORNO"|"FRIO"|null,
  "segmento": "ADULTO"|"KIDS"|"TEENS"|"EMPRESA"|null,
  "etapaSugerida": string|null,
  "justificativa": string
}
Regras:
- Escreva os textos do resumo em português, curtos (máx. 120 caracteres por campo).
- Sugira APENAS o que a conversa evidencia; campo sem evidência = null.
- Não repita o que já está igual no CRM (o estado atual vem no contexto) — nesse caso use null.
- "etapaSugerida" só pode ser uma das etapas permitidas listadas no contexto; sem certeza = null.
- "justificativa": 1 frase explicando as sugestões.`;

function extrairJson(texto: string): unknown {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio === -1 || fim <= inicio) throw new Error("resposta sem JSON");
  return JSON.parse(texto.slice(inicio, fim + 1));
}

const TEMPERATURAS = new Set<string>(Object.values(Temperatura));
const SEGMENTOS = new Set<string>(Object.values(Segmento));

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null;
}

/** Valida/normaliza a resposta do modelo — NUNCA confia no shape cru. */
function normalizar(bruto: unknown, ctx: ContextoAnalise): AnaliseLead {
  const o = (bruto ?? {}) as Record<string, unknown>;
  const r = (o.resumo ?? null) as Record<string, unknown> | null;
  const resumo = r
    ? {
        interesse: texto(r.interesse),
        objetivo: texto(r.objetivo),
        urgencia: texto(r.urgencia),
        orcamento: texto(r.orcamento),
        objecao: texto(r.objecao),
        proximaAcao: texto(r.proximaAcao),
      }
    : null;
  const temperatura =
    typeof o.temperatura === "string" && TEMPERATURAS.has(o.temperatura) ? (o.temperatura as Temperatura) : null;
  const segmento = typeof o.segmento === "string" && SEGMENTOS.has(o.segmento) ? (o.segmento as Segmento) : null;
  const etapaSugerida =
    typeof o.etapaSugerida === "string" && ctx.lead.etapasPermitidas.includes(o.etapaSugerida as EtapaLead)
      ? (o.etapaSugerida as EtapaLead)
      : null;
  return {
    resumo: resumo && Object.values(resumo).some((v) => v !== null) ? resumo : null,
    temperatura: temperatura === ctx.lead.temperatura ? null : temperatura,
    segmento: segmento === ctx.lead.segmento ? null : segmento,
    etapaSugerida: etapaSugerida === ctx.lead.etapa ? null : etapaSugerida,
    justificativa: texto(o.justificativa) ?? "Análise da conversa.",
  };
}

export const driverClaude: DriverIA = {
  get nome() {
    return modelo();
  },
  async analisar(ctx: ContextoAnalise): Promise<AnaliseLead> {
    const chave = process.env.ANTHROPIC_API_KEY;
    if (!chave) throw new Error("ANTHROPIC_API_KEY ausente");

    const contexto = {
      lead: ctx.lead,
      mensagens: ctx.mensagens.slice(-30),
      notasInternas: ctx.notasInternas.slice(-5),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": chave,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelo(),
          max_tokens: 1024,
          system: SYSTEM,
          messages: [{ role: "user", content: JSON.stringify(contexto) }],
        }),
      });
      if (!resp.ok) throw new Error(`Anthropic API ${resp.status}`);
      const corpo = (await resp.json()) as { content?: { type: string; text?: string }[] };
      const textoResposta = (corpo.content ?? []).find((c) => c.type === "text")?.text ?? "";
      return normalizar(extrairJson(textoResposta), ctx);
    } finally {
      clearTimeout(timer);
    }
  },
};
