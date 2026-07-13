import {
  ErroDriver,
  type CanalWhatsApp,
  type EnvioMidia,
  type EnvioTemplate,
  type NumeroCanal,
  type ResultadoEnvio,
} from "../canal";

// Driver NÃO-OFICIAL — Baileys via Evolution API self-hosted (doc 26 §Motores).
// Credenciais por env: EVOLUTION_URL + EVOLUTION_APIKEY. A instância (1 por número) vem do
// NumeroWhatsApp.providerRef. Não existe "template" no protocolo: template = texto livre já
// renderizado (o ciclo de aprovação da Meta não se aplica — doc 26 §Camada 2).

async function chamarEvolution(
  numero: NumeroCanal,
  rota: string,
  body: Record<string, unknown>,
): Promise<ResultadoEnvio> {
  const base = process.env.EVOLUTION_URL;
  const apikey = process.env.EVOLUTION_APIKEY;
  if (!base || !apikey) throw new ErroDriver("evolution_sem_config", "EVOLUTION_URL/EVOLUTION_APIKEY não configurados.");
  if (!numero.providerRef) {
    throw new ErroDriver("evolution_sem_instancia", `Número ${numero.telefoneE164} sem instância Evolution.`);
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${base.replace(/\/$/, "")}/${rota}/${numero.providerRef}`, {
      method: "POST",
      headers: { apikey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new ErroDriver("evolution_rede", e instanceof Error ? e.message : "Falha de rede na Evolution API.");
  }

  const json = (await resposta.json().catch(() => ({}))) as {
    key?: { id?: string };
    message?: string;
  };
  if (!resposta.ok) {
    throw new ErroDriver("evolution_api", json.message ?? `Evolution API HTTP ${resposta.status}`);
  }
  const id = json.key?.id;
  if (!id) throw new ErroDriver("evolution_sem_id", "Evolution não devolveu o id da mensagem.");
  return { providerMessageId: id };
}

// mediatype da Evolution para os tipos não-áudio (áudio tem rota própria, vira PTT).
const MEDIATYPE: Record<Exclude<EnvioMidia["tipo"], "AUDIO">, string> = {
  IMAGEM: "image",
  VIDEO: "video",
  DOCUMENTO: "document",
};

export const driverEvolution: CanalWhatsApp = {
  async enviarTexto(numero: NumeroCanal, paraE164: string, corpo: string): Promise<ResultadoEnvio> {
    return chamarEvolution(numero, "message/sendText", {
      number: paraE164.replace(/\D/g, ""),
      text: corpo,
    });
  },

  async enviarTemplate(numero: NumeroCanal, paraE164: string, t: EnvioTemplate): Promise<ResultadoEnvio> {
    // Baileys não tem ciclo de template: envia o corpo já renderizado como texto.
    return chamarEvolution(numero, "message/sendText", {
      number: paraE164.replace(/\D/g, ""),
      text: t.corpoRenderizado,
    });
  },

  async enviarMidia(numero: NumeroCanal, paraE164: string, m: EnvioMidia): Promise<ResultadoEnvio> {
    const number = paraE164.replace(/\D/g, "");
    if (m.tipo === "AUDIO") {
      // Rota própria: vira mensagem de voz (PTT) — sem legenda no protocolo.
      return chamarEvolution(numero, "message/sendWhatsAppAudio", { number, audio: m.dadosBase64 });
    }
    return chamarEvolution(numero, "message/sendMedia", {
      number,
      mediatype: MEDIATYPE[m.tipo],
      mimetype: m.mime,
      media: m.dadosBase64,
      fileName: m.nomeArquivo,
      ...(m.legenda ? { caption: m.legenda } : {}),
    });
  },
};
