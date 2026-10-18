import type { DriverWhatsApp } from "@prisma/client";

/**
 * Funções que só o motor próprio executa, em lista única: o tipo `RecursoMotor` sai daqui, e `capacidadesDoNumero`
 * e o mapa abaixo usam a mesma constante. Fora do motor conectado ficam visíveis e desabilitadas, com o aviso abaixo.
 */
export const RECURSOS_MOTOR = [
  "editar", "apagar", "reagir", "enquete", "figurinha", "gif", "localizacao", "cartaoContato",
  "responderCitando", "confirmacaoLeitura", "digitando", "grupoEnviar", "grupoGerir", "bloquear",
] as const;
export type RecursoMotor = (typeof RECURSOS_MOTOR)[number];

export const AVISO_RECURSO_MOTOR = "Disponível quando o motor próprio da escola entrar em uso.";

/**
 * Recursos liberados por driver: só o MOTOR executa; drivers legados do enum não executam nenhum.
 * É `Partial` de propósito: um driver ausente do mapa não libera nada, então o mapa continua compilando quando o
 * enum ganha um valor novo, em qualquer ordem de merge. O driver sozinho não basta: a tela usa `capacidades` da
 * thread (`capacidadesDoNumero`), que também exige número ativo e sessão CONECTADO.
 */
const LIBERADOS: Partial<Record<DriverWhatsApp, ReadonlySet<RecursoMotor>>> = {
  // O motor próprio executa todos; driver legado ausente do mapa não libera nada.
  MOTOR: new Set(RECURSOS_MOTOR),
};

export function recursoDisponivel(driver: DriverWhatsApp, r: RecursoMotor): boolean {
  return LIBERADOS[driver]?.has(r) ?? false;
}

const MIMES_VOZ = new Set(["audio/ogg", "audio/mpeg", "audio/mp4"]);

/** MIME aceito para mensagem de voz (ignora parâmetros como `;codecs=opus`). */
export function mimeVozAceito(mime: string): boolean {
  return MIMES_VOZ.has(mime.split(";")[0].trim().toLowerCase());
}
