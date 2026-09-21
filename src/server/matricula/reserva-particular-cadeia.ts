import type { Prisma } from "@prisma/client";
import { ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { z } from "zod";

/** Resolve a cadeia preservada; não concede disponibilidade ou autorização de acesso. */
export async function resolverReservaParticularAtual(tx: Prisma.TransactionClient, inicialId: string) {
  const visitadas = new Set<string>();
  let atualId = inicialId;
  while (true) {
    if (visitadas.has(atualId)) throw new ErroRegra("Cadeia de reservas inconsistente.");
    visitadas.add(atualId);
    const proxima = await tx.retomadaReservaParticular.findUnique({ where: { anteriorId: atualId }, select: { novaId: true } });
    if (!proxima) return atualId;
    atualId = proxima.novaId;
  }
}

/** Primitiva interna: chamar na mesma transação que cria a nova reserva após
 * conferir condições/documentos. Não é Server Action nem executor de retomada completo. */
export async function vincularNovaReservaParticularTx(tx: Prisma.TransactionClient, input: { anteriorId: string; novaId: string; autorId: string; motivo: string }) {
  const d = z.object({ anteriorId: z.string().min(1), novaId: z.string().min(1), autorId: z.string().min(1), motivo: z.string().trim().min(5).max(2000) }).strict().parse(input);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const anterior = await tx.reservaAgendaParticular.findUnique({ where: { id: d.anteriorId } });
  if (!anterior) throw new ErroRegra("Reserva anterior não encontrada.");
  await bloquearMatriculas(tx, [anterior.matriculaId]);
  const autor = await tx.usuario.findUnique({ where: { id: d.autorId }, select: { ativo: true, papeis: true } });
  if (!autor?.ativo || !autor.papeis.some((p) => p === "ADMINISTRADOR" || p === "SECRETARIA_ACADEMICA")) throw new ErroPermissao();
  const repetida = await tx.retomadaReservaParticular.findUnique({ where: { anteriorId: d.anteriorId } });
  if (repetida) {
    if (repetida.novaId !== d.novaId || repetida.autorId !== d.autorId || repetida.motivo !== d.motivo) throw new ErroRegra("Reserva já retomada por outro vínculo.");
    return { id: repetida.id };
  }
  const m = await tx.matricula.findUniqueOrThrow({ where: { id: anterior.matriculaId }, select: { status: true, preparacaoComercial: { select: { reservaParticularId: true } } } });
  const inicial = m.preparacaoComercial?.reservaParticularId;
  if (!inicial || !["RASCUNHO", "AGUARDANDO"].includes(m.status) || await resolverReservaParticularAtual(tx, inicial) !== d.anteriorId) throw new ErroRegra("Confira a reserva atual da preparação.");
  const nova = await tx.reservaAgendaParticular.findUnique({ where: { id: d.novaId } });
  if (!nova || nova.matriculaId !== anterior.matriculaId || nova.status !== "ATIVA" || nova.expiraEm <= new Date() || !["EXPIRADA", "LIBERADA"].includes(anterior.status)) throw new ErroRegra("Confira as reservas anterior e nova desta matrícula.");
  const registro = await tx.retomadaReservaParticular.create({ data: d });
  await registrarEvento(tx, { tipo: "NovaReservaParticularVinculada", agregadoTipo: "Matricula", agregadoId: anterior.matriculaId, autorId: d.autorId, payload: { retomadaId: registro.id, anteriorId: d.anteriorId, novaId: d.novaId, motivo: d.motivo } });
  return { id: registro.id };
}
