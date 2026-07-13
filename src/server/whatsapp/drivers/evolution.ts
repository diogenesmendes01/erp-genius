import { ErroDriver, type CanalWhatsApp, type EnvioTemplate, type NumeroCanal, type ResultadoEnvio } from "../canal";

// Driver NÃO-OFICIAL — Baileys via Evolution API self-hosted (doc 26 §Motores).
// Credenciais por env: EVOLUTION_URL + EVOLUTION_APIKEY. A instância (1 por número) vem do
// NumeroWhatsApp.providerRef. Não existe "template" no protocolo: template = texto livre já
// renderizado (o ciclo de aprovação da Meta não se aplica — doc 26 §Camada 2).

async function chamarEvolution(
  numero: NumeroCanal,
  paraE164: string,
  corpo: string,
): Promise<ResultadoEnvio> {
  const base = process.env.EVOLUTION_URL;
  const apikey = process.env.EVOLUTION_APIKEY;
  if (!base || !apikey) throw new ErroDriver("evolution_sem_config", "EVOLUTION_URL/EVOLUTION_APIKEY não configurados.");
  if (!numero.providerRef) {
    throw new ErroDriver("evolution_sem_instancia", `Número ${numero.telefoneE164} sem instância Evolution.`);
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${base.replace(/\/$/, "")}/message/sendText/${numero.providerRef}`, {
      method: "POST",
      headers: { apikey, "Content-Type": "application/json" },
      body: JSON.stringify({ number: paraE164.replace(/\D/g, ""), text: corpo }),
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

export const driverEvolution: CanalWhatsApp = {
  async enviarTexto(numero: NumeroCanal, paraE164: string, corpo: string): Promise<ResultadoEnvio> {
    return chamarEvolution(numero, paraE164, corpo);
  },

  async enviarTemplate(numero: NumeroCanal, paraE164: string, t: EnvioTemplate): Promise<ResultadoEnvio> {
    // Baileys não tem ciclo de template: envia o corpo já renderizado como texto.
    return chamarEvolution(numero, paraE164, t.corpoRenderizado);
  },
};
