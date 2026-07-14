import type { DriverWhatsApp } from "@prisma/client";

// PORTA do canal (doc 26 §Camada 0): interface única que os drivers implementam.
// REGRA DE FRONTEIRA (doc 29): só o despachante importa drivers; régua/inbox/lote gravam
// intenções e nunca sabem qual motor mandou.

export interface NumeroCanal {
  id: string;
  telefoneE164: string;
  driver: DriverWhatsApp;
  /** META_CLOUD: phone_number_id · BAILEYS: nome da instância Evolution. */
  providerRef: string | null;
}

export interface EnvioTemplate {
  /** Nome do template registrado (Meta) — no Baileys é ignorado (texto livre). */
  nome: string;
  idioma: string;
  /** Valores posicionais {{1}}..{{n}} na ordem. */
  variaveis: string[];
  /** Corpo já renderizado — usado pelo Baileys e como fallback de auditoria. */
  corpoRenderizado: string;
}

export interface EnvioMidia {
  /** Tipo normalizado da mensagem (enum TipoMensagem, sem TEXTO/OUTRO). */
  tipo: "IMAGEM" | "AUDIO" | "VIDEO" | "DOCUMENTO";
  mime: string;
  nomeArquivo: string;
  /** Binário em base64 — lido do storage privado pelo despachante (midia.ts). */
  dadosBase64: string;
  legenda?: string | null;
}

export interface ResultadoEnvio {
  providerMessageId: string;
}

/** Falha de driver com motivo estável (vai para IntencaoMensagem.motivoFalha e fila humana). */
export class ErroDriver extends Error {
  constructor(
    public readonly motivo: string,
    mensagem?: string,
  ) {
    super(mensagem ?? motivo);
    this.name = "ErroDriver";
  }
}

export interface CanalWhatsApp {
  enviarTexto(numero: NumeroCanal, paraE164: string, corpo: string): Promise<ResultadoEnvio>;
  enviarTemplate(numero: NumeroCanal, paraE164: string, template: EnvioTemplate): Promise<ResultadoEnvio>;
  enviarMidia(numero: NumeroCanal, paraE164: string, midia: EnvioMidia): Promise<ResultadoEnvio>;
}
