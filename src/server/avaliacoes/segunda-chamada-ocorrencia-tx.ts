import { randomUUID } from "node:crypto";
import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { instanteUtcSql } from "./segunda-chamada-utc";

export const RegistrarOcorrenciaSegundaChamadaSchema = z.object({
  reservaId: z.string().min(1).max(100),
  tipo: z.enum(["CANCELAMENTO_ESCOLA", "CANCELAMENTO_ALUNO", "FALTA", "IMPEDIMENTO_ESCOLA"]),
  ocorridaEm: z.string().datetime({ offset: true }),
  motivo: z.string().trim().min(5).max(2000),
  evidencia: z.string().trim().min(5).max(4000),
}).strict();

/** Núcleo transacional; a action e testes compartilham as mesmas invariantes. */
export async function registrarOcorrenciaSegundaChamadaTx(tx: PrismaTypes.TransactionClient, autorId: string, input: z.input<typeof RegistrarOcorrenciaSegundaChamadaSchema>) {
  const d = RegistrarOcorrenciaSegundaChamadaSchema.parse(input);
  if (d.tipo === "CANCELAMENTO_ESCOLA" || d.tipo === "CANCELAMENTO_ALUNO") throw new ErroRegra("Cancelamento exige proposta e aprovação independente da agenda.");
  const [r] = await tx.$queryRaw<{ id: string; matriculaId: string; alocacaoId: string; status: string; regraCancelamentoMinutos: number; reservadaEm: Date; inicio: Date | null }[]>(Prisma.sql`
    SELECT r.id,r."matriculaId" AS "matriculaId",p."alocacaoId" AS "alocacaoId",r.status,r."regraCancelamentoMinutos" AS "regraCancelamentoMinutos",r."reservadaEm" AS "reservadaEm",e.inicio
    FROM "ReservaSegundaChamada" r JOIN "PropostaSegundaChamada" p ON p.id=r."propostaId" LEFT JOIN "AgendaSegundaChamada" a ON a."reservaId"=r.id LEFT JOIN "EncontroAgenda" e ON e.id=a."encontroId" WHERE r.id=${d.reservaId} FOR UPDATE OF r
  `);
  if (!r) throw new ErroRegra("Reserva de segunda chamada não encontrada.");
  await bloquearLancamento(tx, r.alocacaoId); await conferirGestorAvaliacao(tx, autorId);
  const quando = new Date(d.ocorridaEm); if (quando > new Date()) throw new ErroRegra("Ocorrência futura não pode ser registrada.");
  if (quando < r.reservadaEm) throw new ErroRegra("A ocorrência não pode anteceder a reserva registrada.");
  if (d.tipo === "FALTA" && (!r.inicio || quando < r.inicio)) throw new ErroRegra("A falta só pode ocorrer a partir do início agendado.");
  const status = d.tipo === "FALTA" ? "CONSUMIDA_FALTA" : "PENDENCIA_ESCOLA";
  if (r.status !== "RESERVADA") {
    const [anterior] = await tx.$queryRaw<{ id: string; status: string; ocorridaEm: Date; motivo: string; evidencia: string; registradaPorId: string }[]>(Prisma.sql`
      SELECT id,status,"ocorridaEm" AS "ocorridaEm",motivo,evidencia,"registradaPorId" AS "registradaPorId"
      FROM "OcorrenciaSegundaChamada" WHERE "reservaId"=${r.id}
      ORDER BY "criadaEm" DESC,id DESC LIMIT 1 FOR SHARE
    `);
    if (anterior && anterior.status === status && anterior.registradaPorId === autorId && anterior.ocorridaEm.getTime() === quando.getTime() && anterior.motivo === d.motivo && anterior.evidencia === d.evidencia) return { id: anterior.id, status: anterior.status };
    throw new ErroRegra("A reserva já possui uma ocorrência terminal.");
  }
  await tx.$executeRaw(Prisma.sql`UPDATE "ReservaSegundaChamada" SET status=${status}::"StatusReservaSegundaChamada" WHERE id=${r.id}`);
  const ocorrenciaId = randomUUID(); await tx.$executeRaw(Prisma.sql`INSERT INTO "OcorrenciaSegundaChamada" (id,"reservaId","registradaPorId",status,"ocorridaEm",motivo,evidencia) VALUES (${ocorrenciaId},${r.id},${autorId},${status}::"StatusReservaSegundaChamada",${instanteUtcSql(quando)},${d.motivo},${d.evidencia})`);
  await registrarEvento(tx, { tipo: "SegundaChamadaOcorrenciaRegistrada", agregadoTipo: "Matricula", agregadoId: r.matriculaId, autorId, payload: { reservaId: r.id, ocorrenciaId, tipo: d.tipo, status } });
  return { id: ocorrenciaId, status };
}
