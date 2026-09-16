import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { carregarEstadoConferenciaFinalAditivoTx } from "./aditivo-conferencia-final-estado";
const Entrada = z.object({ matriculaId: z.string().min(1), propostaId: z.string().min(1), conclusaoId: z.string().min(1), revisaoHash: z.string().regex(/^[a-f0-9]{64}$/), documentoConferido: z.literal(true), evidenciasConferidas: z.literal(true), motivo: z.string().trim().min(5).max(2000) }).strict();
export async function registrarConferenciaFinalAditivoTx(tx: Prisma.TransactionClient, autorId: string, entrada: unknown) {
  const d = Entrada.parse(entrada); await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const referencia = await tx.conclusaoAssinaturaAditivo.findFirst({ where: { id: d.conclusaoId, processo: { propostaId: d.propostaId, proposta: { matriculaId: d.matriculaId } } }, select: { processoId: true } });
  if (!referencia) throw new ErroRegra("Conclusão de aditivo indisponível neste escopo.");
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${d.matriculaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaAditivo" WHERE id = ${referencia.processoId} FOR UPDATE`;
  const estado = await carregarEstadoConferenciaFinalAditivoTx(tx, d); await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`; await conferirAutor(tx, autorId);
  if (d.revisaoHash !== estado.revisaoHash) throw new ErroRegra("A conclusão ou o processo mudou. Revise antes de confirmar.");
  const anterior = await tx.conferenciaFinalAditivo.findUnique({ where: { conclusaoId: d.conclusaoId } });
  if (anterior) { if (anterior.autorId !== autorId || anterior.revisaoHash !== d.revisaoHash || anterior.motivo !== d.motivo) throw new ErroRegra("A conclusão já recebeu outra conferência final."); return { id: anterior.id, revisaoHash: anterior.revisaoHash }; }
  const c = await tx.conferenciaFinalAditivo.create({ data: { conclusaoId: d.conclusaoId, autorId, revisaoHash: estado.revisaoHash, snapshot: estado.dados, motivo: d.motivo } });
  await registrarEvento(tx, { tipo: "ConferenciaFinalAditivoRegistrada", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId, payload: { propostaId: d.propostaId, conclusaoId: d.conclusaoId, conferenciaId: c.id } }); return { id: c.id, revisaoHash: c.revisaoHash };
}
