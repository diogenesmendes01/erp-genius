import {
  ErroDriver,
  type CanalWhatsApp,
  type EnvioMidia,
  type EnvioTemplate,
  type NumeroCanal,
  type ResultadoEnvio,
} from "../canal";

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

/** Sobe o binário para a Media API (multipart) e devolve o media_id para o envio. */
async function subirMidia(numero: NumeroCanal, m: EnvioMidia): Promise<string> {
  const token = process.env.META_WA_TOKEN;
  if (!token) throw new ErroDriver("meta_sem_token", "META_WA_TOKEN não configurado.");
  if (!numero.providerRef) {
    throw new ErroDriver("meta_sem_provider_ref", `Número ${numero.telefoneE164} sem phone_number_id.`);
  }

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", m.mime);
  form.append("file", new Blob([Uint8Array.from(Buffer.from(m.dadosBase64, "base64"))], { type: m.mime }), m.nomeArquivo);

  let resposta: Response;
  try {
    resposta = await fetch(`${GRAPH_BASE}/${numero.providerRef}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch (e) {
    throw new ErroDriver("meta_rede", e instanceof Error ? e.message : "Falha de rede na Media API.");
  }
  const json = (await resposta.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!resposta.ok || !json.id) {
    throw new ErroDriver("meta_upload_midia", json.error?.message ?? `Media API HTTP ${resposta.status}`);
  }
  return json.id;
}

// Tipo do payload da Cloud API por tipo normalizado. Áudio não aceita caption (Meta).
const CAMPO_MIDIA: Record<EnvioMidia["tipo"], "image" | "audio" | "video" | "document"> = {
  IMAGEM: "image",
  AUDIO: "audio",
  VIDEO: "video",
  DOCUMENTO: "document",
};

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

  async enviarMidia(numero: NumeroCanal, paraE164: string, m: EnvioMidia): Promise<ResultadoEnvio> {
    const mediaId = await subirMidia(numero, m);
    const campo = CAMPO_MIDIA[m.tipo];
    const objeto: Record<string, unknown> = { id: mediaId };
    if (m.legenda && campo !== "audio") objeto.caption = m.legenda;
    if (campo === "document") objeto.filename = m.nomeArquivo;
    return chamarGraph(numero, { to: paraE164.replace(/\D/g, ""), type: campo, [campo]: objeto });
  },
};
