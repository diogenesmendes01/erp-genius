import { ErroDriver, type CanalWhatsApp, type EnvioTemplate, type NumeroCanal, type ResultadoEnvio } from "../canal";

// Driver OFICIAL — WhatsApp Cloud API direto da Meta (doc 08/26, sem BSP).
// Credenciais por env: META_WA_TOKEN (system user, permanente). O phone_number_id vem do
// NumeroWhatsApp.providerRef. Fora da janela de 24h só template APROVADO passa — a Meta
// rejeita texto livre; o despachante decide qual método chamar.

const GRAPH_BASE = process.env.META_WA_GRAPH_URL ?? "https://graph.facebook.com/v21.0";

async function chamarGraph(
  numero: NumeroCanal,
  body: Record<string, unknown>,
): Promise<ResultadoEnvio> {
  const token = process.env.META_WA_TOKEN;
  if (!token) throw new ErroDriver("meta_sem_token", "META_WA_TOKEN não configurado.");
  if (!numero.providerRef) {
    throw new ErroDriver("meta_sem_provider_ref", `Número ${numero.telefoneE164} sem phone_number_id.`);
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${GRAPH_BASE}/${numero.providerRef}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
    });
  } catch (e) {
    throw new ErroDriver("meta_rede", e instanceof Error ? e.message : "Falha de rede na Graph API.");
  }

  const json = (await resposta.json().catch(() => ({}))) as {
    messages?: { id?: string }[];
    error?: { message?: string; code?: number };
  };
  if (!resposta.ok) {
    throw new ErroDriver("meta_api", json.error?.message ?? `Graph API HTTP ${resposta.status}`);
  }
  const id = json.messages?.[0]?.id;
  if (!id) throw new ErroDriver("meta_sem_wamid", "Graph API não devolveu o id da mensagem.");
  return { providerMessageId: id };
}

export const driverMetaCloud: CanalWhatsApp = {
  async enviarTexto(numero: NumeroCanal, paraE164: string, corpo: string): Promise<ResultadoEnvio> {
    return chamarGraph(numero, {
      to: paraE164.replace(/\D/g, ""),
      type: "text",
      text: { body: corpo },
    });
  },

  async enviarTemplate(numero: NumeroCanal, paraE164: string, t: EnvioTemplate): Promise<ResultadoEnvio> {
    return chamarGraph(numero, {
      to: paraE164.replace(/\D/g, ""),
      type: "template",
      template: {
        name: t.nome,
        language: { code: t.idioma },
        components: t.variaveis.length
          ? [{ type: "body", parameters: t.variaveis.map((v) => ({ type: "text", text: v })) }]
          : [],
      },
    });
  },
};
