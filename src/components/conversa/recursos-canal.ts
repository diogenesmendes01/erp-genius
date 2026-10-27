import type { DriverWhatsApp } from "@prisma/client";

export const RECURSOS_MOTOR = [
  "editar", "apagar", "reagir", "encaminhar", "enquete", "figurinha", "gif", "localizacao", "cartaoContato",
  "responderCitando", "confirmacaoLeitura", "digitando", "grupoEnviar", "grupoGerir", "bloquear",
] as const;
export type RecursoMotor = (typeof RECURSOS_MOTOR)[number];

export const AVISO_RECURSO_MOTOR = "Disponível quando o motor próprio da escola entrar em uso.";

const LIBERADOS: Partial<Record<DriverWhatsApp, ReadonlySet<RecursoMotor>>> = {
  MOTOR: new Set(RECURSOS_MOTOR),
};

export function recursoDisponivel(driver: DriverWhatsApp, r: RecursoMotor): boolean {
  return LIBERADOS[driver]?.has(r) ?? false;
}

const MIMES_VOZ = new Set(["audio/ogg", "audio/mpeg", "audio/mp4"]);

export function mimeVozAceito(mime: string): boolean {
  return MIMES_VOZ.has(mime.split(";")[0].trim().toLowerCase());
}
