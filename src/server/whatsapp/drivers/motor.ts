import {
  ErroDriver,
  type CanalWhatsApp,
  type ConteudoEspecial,
  type EnvioMidia,
  type EnvioTemplate,
  type NumeroCanal,
  type OpcoesEnvio,
  type ResultadoEnvio,
} from "../canal";
import { chamarMotor, ErroMotor, TIMEOUT_MIDIA_MS, TIMEOUT_TEXTO_MS } from "../motor/cliente";

// Driver do motor próprio (whatsapp-web-baileys, modo serviço). O motor é só transporte:
// o ERP gera o clientMessageId e o motor devolve providerMessageId + mensagemIdMotor.

const MOTIVOS_REPROCESSAVEIS = new Set(["numero_desconectado", "motor_encerrando", "limite_ritmo"]);
const ADIAR_PADRAO_MS = 60_000;
const ADIAR_EM_ANDAMENTO_MS = 120_000;

interface RespostaEnvioMotor {
  providerMessageId?: string;
  mensagemIdMotor?: string | null;
}

function traduzirErro(e: unknown): never {
  if (!(e instanceof ErroMotor)) throw e;
  const reproc = (motivo: string, adiarMs = ADIAR_PADRAO_MS) =>
    new ErroDriver(motivo, e.message, { reprocessavel: true, adiarMs });
  switch (e.codigo) {
    case "RESULTADO_INCERTO":
      throw new ErroDriver("resultado_incerto", e.message);
    case "EM_ANDAMENTO":
      throw reproc("motor_em_andamento", ADIAR_EM_ANDAMENTO_MS);
    case "INDISPONIVEL":
    case "TIMEOUT":
      throw reproc(`motor_${e.codigo.toLowerCase()}`);
    case "LIMITE_RITMO":
      throw reproc("motor_limite_ritmo");
    case "NAO_ENVIADO": {
      const motivo = e.motivo ?? "nao_enviado";
      const nome = `motor_${motivo.toLowerCase()}`;
      if (MOTIVOS_REPROCESSAVEIS.has(motivo)) throw reproc(nome);
      throw new ErroDriver(nome, e.message);
    }
    default:
      throw new ErroDriver(`motor_${(e.motivo ?? e.codigo).toLowerCase()}`, e.message);
  }
}

function cabecalhos(opcoes: OpcoesEnvio): Record<string, string> {
  return { "x-origem": opcoes.origem === "HUMANO" ? "HUMANO" : "AUTOMACAO" };
}

function destinatario(destino: string): { para: string } | { paraE164: string } {
  return destino.includes("@") ? { para: destino } : { paraE164: destino };
}

function numeroId(numero: NumeroCanal): string {
  return encodeURIComponent(numero.providerRef ?? numero.id);
}

function citacao(opcoes: OpcoesEnvio): Record<string, unknown> {
  return opcoes.citarMensagemIdMotor ? { citarMensagemId: opcoes.citarMensagemIdMotor } : {};
}

function resultado(r: RespostaEnvioMotor | undefined): ResultadoEnvio {
  if (!r?.providerMessageId) throw new ErroDriver("motor_sem_id", "Motor não devolveu o id da mensagem.");
  return { providerMessageId: r.providerMessageId, mensagemIdMotor: r.mensagemIdMotor ?? null };
}

async function enviarJson(
  numero: NumeroCanal,
  destino: string,
  conteudo: Record<string, unknown>,
  opcoes: OpcoesEnvio,
): Promise<ResultadoEnvio> {
  try {
    const r = await chamarMotor<RespostaEnvioMotor>(`/v1/numeros/${numeroId(numero)}/mensagens`, {
      metodo: "POST",
      timeoutMs: TIMEOUT_TEXTO_MS,
      json: { clientMessageId: opcoes.clientMessageId, ...destinatario(destino), ...citacao(opcoes), ...conteudo },
      cabecalhos: cabecalhos(opcoes),
    });
    return resultado(r);
  } catch (e) {
    return traduzirErro(e);
  }
}

const TIPO_MIDIA: Record<EnvioMidia["tipo"], string> = {
  IMAGEM: "imagem",
  VIDEO: "video",
  AUDIO: "audio",
  DOCUMENTO: "documento",
};

async function enviarMultipart(
  numero: NumeroCanal,
  destino: string,
  conteudo: Record<string, unknown>,
  midia: EnvioMidia,
  opcoes: OpcoesEnvio,
): Promise<ResultadoEnvio> {
  const form = new FormData();
  form.append(
    "payload",
    JSON.stringify({ clientMessageId: opcoes.clientMessageId, ...destinatario(destino), ...citacao(opcoes), ...conteudo }),
  );
  form.append("arquivo", new Blob([Uint8Array.from(Buffer.from(midia.dadosBase64, "base64"))], { type: midia.mime }), midia.nomeArquivo);
  try {
    const r = await chamarMotor<RespostaEnvioMotor>(`/v1/numeros/${numeroId(numero)}/mensagens`, {
      metodo: "POST",
      timeoutMs: TIMEOUT_MIDIA_MS,
      form,
      cabecalhos: cabecalhos(opcoes),
    });
    return resultado(r);
  } catch (e) {
    return traduzirErro(e);
  }
}

function conteudoMidia(m: EnvioMidia): Record<string, unknown> {
  return {
    tipo: TIPO_MIDIA[m.tipo],
    ...(m.tipo === "AUDIO" ? { ptt: true } : {}),
    ...(m.legenda && m.tipo !== "AUDIO" ? { legenda: m.legenda } : {}),
    nomeArquivo: m.nomeArquivo,
    mime: m.mime,
  };
}

function conteudoEspecial(c: ConteudoEspecial): Record<string, unknown> {
  switch (c.tipo) {
    case "FIGURINHA":
      return { tipo: "figurinha" };
    case "GIF":
      return { tipo: "imagem", gif: true };
    case "ENQUETE":
      return { tipo: "enquete", enquete: { nome: c.nome, opcoes: c.opcoes, maxEscolhas: c.maxEscolhas } };
    case "LOCALIZACAO":
      return { tipo: "localizacao", localizacao: { latitude: c.latitude, longitude: c.longitude, ...(c.nome ? { nome: c.nome } : {}) } };
    case "CONTATO":
      return { tipo: "contato", contatoJid: c.contatoJid };
  }
}

export const driverMotor: CanalWhatsApp = {
  enviarTexto(numero: NumeroCanal, destino: string, corpo: string, opcoes: OpcoesEnvio) {
    return enviarJson(numero, destino, { tipo: "texto", texto: corpo }, opcoes);
  },

  // O motor não tem ciclo de template: envia o corpo já renderizado como texto.
  enviarTemplate(numero: NumeroCanal, destino: string, t: EnvioTemplate, opcoes: OpcoesEnvio) {
    return enviarJson(numero, destino, { tipo: "texto", texto: t.corpoRenderizado }, opcoes);
  },

  enviarMidia(numero: NumeroCanal, destino: string, m: EnvioMidia, opcoes: OpcoesEnvio) {
    return enviarMultipart(numero, destino, conteudoMidia(m), m, opcoes);
  },

  enviarConteudo(numero, destino, conteudo, midia, opcoes) {
    const corpo = conteudoEspecial(conteudo);
    if ((conteudo.tipo === "FIGURINHA" || conteudo.tipo === "GIF") && midia) {
      return enviarMultipart(numero, destino, corpo, midia, opcoes);
    }
    return enviarJson(numero, destino, corpo, opcoes);
  },
};
