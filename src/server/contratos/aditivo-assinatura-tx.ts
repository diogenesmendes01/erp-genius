import { Prisma } from "@prisma/client";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { RegistrarConferenciaAssinaturaAditivoSchema } from "./aditivo-assinatura-schema";
import { consultarEstadoAssinaturaAditivoTx } from "./aditivo-assinatura-estado";
import { hashSubstituicao } from "./substituicao-estado";

const json = (valor: unknown): Prisma.InputJsonObject => JSON.parse(JSON.stringify(valor));

/** Registra a revisão administrativa do original já preservado. Não envia nem aplica o aditivo. */
export async function registrarConferenciaAssinaturaAditivoTx(tx: Prisma.TransactionClient, autorId: string, entrada: unknown) {
  const d = RegistrarConferenciaAssinaturaAditivoSchema.parse(entrada);
  const entradaHash = hashSubstituicao(json(d) as Prisma.JsonObject);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  await conferirAutor(tx, autorId);
  const repetida = await tx.conferenciaAssinaturaAditivo.findUnique({ where: { autorId_chaveIdempotencia: { autorId, chaveIdempotencia: d.chaveIdempotencia } } });
  if (repetida) {
    if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada com outra conferência interna de aditivo.");
    return { id: repetida.id, revisaoHash: repetida.revisaoHash };
  }
  const estado = await consultarEstadoAssinaturaAditivoTx(tx, d);
  if (d.revisaoHash !== estado.revisaoHash) throw new ErroRegra("O original ou sua conferência mudou. Revise os dados antes de confirmar.");
  const conferencia = await tx.conferenciaAssinaturaAditivo.create({ data: { artefatoId: d.artefatoId, autorId, revisaoHash: estado.revisaoHash,
    snapshot: json(estado.snapshot), motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash } });
  await registrarEvento(tx, { tipo: "AssinaturaAditivoConferida", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId,
    payload: { propostaId: d.propostaId, artefatoId: d.artefatoId, conferenciaId: conferencia.id, revisaoHash: conferencia.revisaoHash } });
  return { id: conferencia.id, revisaoHash: conferencia.revisaoHash };
}
