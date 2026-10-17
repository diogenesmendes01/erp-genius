import type { DriverWhatsApp, OrigemEnvio } from "@prisma/client";

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

export interface OpcoesEnvio {
  /** UUID gerado pelo ERP antes do envio; separa o eco do ERP do eco do celular. */
  clientMessageId: string;
  origem: OrigemEnvio;
  /** Id da mensagem citada no motor (`<jid>:<id>`), quando a saída é uma resposta. */
  citarMensagemIdMotor?: string | null;
}

export interface ResultadoEnvio {
  providerMessageId: string;
  mensagemIdMotor?: string | null;
}

export type ConteudoEspecial =
  | { tipo: "FIGURINHA" }
  | { tipo: "GIF" }
  | { tipo: "ENQUETE"; nome: string; opcoes: string[]; maxEscolhas: number }
  | { tipo: "LOCALIZACAO"; latitude: number; longitude: number; nome?: string }
  | { tipo: "CONTATO"; contatoJid: string };

/** Falha de driver com motivo estável (vai para IntencaoMensagem.motivoFalha e fila humana). */
export class ErroDriver extends Error {
  readonly reprocessavel: boolean;
  readonly adiarMs: number;
  constructor(
    public readonly motivo: string,
    mensagem?: string,
    opcoes?: { reprocessavel?: boolean; adiarMs?: number },
  ) {
    super(mensagem ?? motivo);
    this.name = "ErroDriver";
    this.reprocessavel = opcoes?.reprocessavel ?? false;
    this.adiarMs = opcoes?.adiarMs ?? 60_000;
  }
}

/** `destino` é E.164 ou JID (contém "@"). */
export interface CanalWhatsApp {
  enviarTexto(numero: NumeroCanal, destino: string, corpo: string, opcoes: OpcoesEnvio): Promise<ResultadoEnvio>;
  enviarTemplate(numero: NumeroCanal, destino: string, template: EnvioTemplate, opcoes: OpcoesEnvio): Promise<ResultadoEnvio>;
  enviarMidia(numero: NumeroCanal, destino: string, midia: EnvioMidia, opcoes: OpcoesEnvio): Promise<ResultadoEnvio>;
  enviarConteudo?(
    numero: NumeroCanal,
    destino: string,
    conteudo: ConteudoEspecial,
    midia: EnvioMidia | null,
    opcoes: OpcoesEnvio,
  ): Promise<ResultadoEnvio>;
}

/** Drivers em que a automação (régua/lote) pode enviar. */
export function driverAceitaAutomacao(driver: DriverWhatsApp): boolean {
  return driver === "MOTOR" || driver === "META_CLOUD";
}
