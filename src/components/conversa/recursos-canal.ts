import type { DriverWhatsApp } from "@prisma/client";

/** Funções que só o motor próprio executa; ficam visíveis e desabilitadas, com este aviso, até a Fase 4. */
export type RecursoMotor =
  | "editar" | "apagar" | "reagir" | "enquete" | "figurinha" | "gif" | "localizacao" | "cartaoContato"
  | "responderCitando" | "confirmacaoLeitura" | "digitando" | "grupoEnviar" | "grupoGerir" | "bloquear";

export const AVISO_RECURSO_MOTOR = "Disponível quando o motor próprio da escola entrar em uso.";

/**
 * Recursos liberados por driver. Meta e Evolution/Baileys não executam nenhum deles; só o MOTOR executa todos. É `Partial` de propósito: um driver ausente do mapa não libera nada, então o mapa
 * continua compilando quando o enum ganha um valor novo, em qualquer ordem de merge.
 */
const TODOS_OS_RECURSOS: readonly RecursoMotor[] = [
  "editar", "apagar", "reagir", "enquete", "figurinha", "gif", "localizacao", "cartaoContato",
  "responderCitando", "confirmacaoLeitura", "digitando", "grupoEnviar", "grupoGerir", "bloquear",
];

const LIBERADOS: Partial<Record<DriverWhatsApp, ReadonlySet<RecursoMotor>>> = {
  META_CLOUD: new Set(),
  BAILEYS: new Set(),
  // O motor próprio executa todos; Meta e Evolution seguem sem nenhum até a Task 25 removê-los.
  MOTOR: new Set(TODOS_OS_RECURSOS),
};

export function recursoDisponivel(driver: DriverWhatsApp, r: RecursoMotor): boolean {
  return LIBERADOS[driver]?.has(r) ?? false;
}

const MIMES_VOZ = new Set(["audio/ogg", "audio/mpeg", "audio/mp4"]);

/** MIME aceito para mensagem de voz (ignora parâmetros como `;codecs=opus`). */
export function mimeVozAceito(mime: string): boolean {
  return MIMES_VOZ.has(mime.split(";")[0].trim().toLowerCase());
}
