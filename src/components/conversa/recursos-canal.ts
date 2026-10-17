import type { DriverWhatsApp } from "@prisma/client";

/** Funções que só o motor próprio executa; ficam visíveis e desabilitadas, com este aviso, até a Fase 4. */
export type RecursoMotor =
  | "editar" | "apagar" | "reagir" | "enquete" | "figurinha" | "gif" | "localizacao" | "cartaoContato"
  | "responderCitando" | "confirmacaoLeitura" | "digitando" | "grupoEnviar" | "grupoGerir" | "bloquear";

export const AVISO_RECURSO_MOTOR = "Disponível quando o motor próprio da escola entrar em uso.";

/** Recursos liberados por driver. Meta e Evolution/Baileys não executam nenhum deles; o valor MOTOR do enum só chega na Fase 4, que preenche este mapa. */
const LIBERADOS: Record<DriverWhatsApp, ReadonlySet<RecursoMotor>> = {
  META_CLOUD: new Set(),
  BAILEYS: new Set(),
};

export function recursoDisponivel(driver: DriverWhatsApp, r: RecursoMotor): boolean {
  return LIBERADOS[driver]?.has(r) ?? false;
}

const MIMES_VOZ = new Set(["audio/ogg", "audio/mpeg", "audio/mp4"]);

/** MIME aceito para mensagem de voz (ignora parâmetros como `;codecs=opus`). */
export function mimeVozAceito(mime: string): boolean {
  return MIMES_VOZ.has(mime.split(";")[0].trim().toLowerCase());
}
