import type { DriverWhatsApp, OrigemEnvio } from "@prisma/client";

export interface NumeroCanal {
  id: string;
  telefoneE164: string;
  driver: DriverWhatsApp;
  providerRef: string | null;
}

export interface EnvioTemplate {
  nome: string;
  idioma: string;
  variaveis: string[];
  corpoRenderizado: string;
}

export interface EnvioMidia {
  tipo: "IMAGEM" | "AUDIO" | "VIDEO" | "DOCUMENTO";
  mime: string;
  nomeArquivo: string;
  dadosBase64: string;
  legenda?: string | null;
}

export interface OpcoesEnvio {
  clientMessageId: string;
  origem: OrigemEnvio;
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

export const MENSAGEM_META_CLOUD_SEM_ENVIO = "Meta Cloud ainda não tem envio disponível.";

export function driverAceitaAutomacao(driver: DriverWhatsApp): boolean {
  return driver === "MOTOR";
}
