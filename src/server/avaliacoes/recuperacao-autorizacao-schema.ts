import { z } from "zod";

const id = z.string().trim().min(1).max(100);
const motivo = z.string().trim().min(5).max(2000);
const chaveIdempotencia = z.string().trim().min(8).max(100);

function dataIsoComOffsetValida(valor: string) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})T/.exec(valor);
  if (!partes || Number.isNaN(Date.parse(valor))) return false;
  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  if (ano < 1 || ano > 9999 || mes < 1 || mes > 12 || dia < 1) return false;
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
  const diasNoMes = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
  if (dia > diasNoMes) return false;
  const instanteUtc = new Date(valor);
  return instanteUtc.getUTCFullYear() >= 1 && instanteUtc.getUTCFullYear() <= 9999;
}

const instante = z.string().datetime({ offset: true }).refine(dataIsoComOffsetValida, "Data ISO com offset inválida.");

/** Entrada estrita da gestão; o contexto acadêmico vem do servidor. */
export const AutorizacaoEspecialRecuperacaoEntradaSchema = z.object({
  itemReservaId: id,
  motivo,
  prazoAte: instante,
  chaveIdempotencia,
}).strict();

/** Nome público do contrato usado pela ação de autorização. */
export const AutorizarRecuperacaoEspecialSchema = AutorizacaoEspecialRecuperacaoEntradaSchema;

/** Registro já resolvido pelo consumidor de banco, sem defaults implícitos. */
export const AutorizacaoEspecialRecuperacaoSchema = z.object({
  id,
  matriculaId: id,
  itemReservaId: id,
  alocacaoId: id,
  regraId: id,
  autorizadorId: id,
  motivo,
  autorizadaEm: instante,
  prazoAte: instante,
  chaveIdempotencia,
}).strict().superRefine((valor, contexto) => {
  if (new Date(valor.autorizadaEm) > new Date(valor.prazoAte)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, path: ["prazoAte"], message: "O prazo precisa ser igual ou posterior à autorização." });
  }
});

export const ContextoRealizacaoAutorizacaoEspecialRecuperacaoSchema = z.object({
  matriculaId: id,
  itemReservaId: id,
  alocacaoId: id,
  regraId: id,
  realizadaEm: instante,
  /** O consumidor de banco calcula este valor a partir do autorizador persistido. */
  autorizadorVigente: z.boolean(),
}).strict();

export type DecisaoVigenciaAutorizacaoEspecialRecuperacao =
  | { vigente: true }
  | {
    vigente: false;
    motivo: "AUTORIZADOR_NAO_VIGENTE" | "CONTEXTO_DIVERGENTE" | "ANTES_DA_AUTORIZACAO" | "PRAZO_VENCIDO";
  };

/**
 * Q151: valida somente o alcance e a janela da autorização persistida.
 * Plano, reserva, limite, agenda e atribuição docente continuam sendo gates
 * independentes do consumidor.
 */
export function decidirVigenciaAutorizacaoEspecialRecuperacao(
  autorizacao: z.input<typeof AutorizacaoEspecialRecuperacaoSchema>,
  realizacao: z.input<typeof ContextoRealizacaoAutorizacaoEspecialRecuperacaoSchema>,
): DecisaoVigenciaAutorizacaoEspecialRecuperacao {
  const autorizacaoValida = AutorizacaoEspecialRecuperacaoSchema.parse(autorizacao);
  const realizacaoValida = ContextoRealizacaoAutorizacaoEspecialRecuperacaoSchema.parse(realizacao);
  if (!realizacaoValida.autorizadorVigente) return { vigente: false, motivo: "AUTORIZADOR_NAO_VIGENTE" };
  if (
    autorizacaoValida.matriculaId !== realizacaoValida.matriculaId
    || autorizacaoValida.itemReservaId !== realizacaoValida.itemReservaId
    || autorizacaoValida.alocacaoId !== realizacaoValida.alocacaoId
    || autorizacaoValida.regraId !== realizacaoValida.regraId
  ) return { vigente: false, motivo: "CONTEXTO_DIVERGENTE" };

  const realizadaEm = new Date(realizacaoValida.realizadaEm);
  if (realizadaEm < new Date(autorizacaoValida.autorizadaEm)) return { vigente: false, motivo: "ANTES_DA_AUTORIZACAO" };
  if (realizadaEm > new Date(autorizacaoValida.prazoAte)) return { vigente: false, motivo: "PRAZO_VENCIDO" };
  return { vigente: true };
}
