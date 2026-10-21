import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { conferirTurmaParaReserva } from "./reserva-disponibilidade";

const Entrada = z.object({ matriculaId: z.string().min(1), turmaId: z.string().min(1), autorId: z.string().min(1),
  motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();

/** Primitiva interna: chamador deve autorizar o contrato. Prazo vem da configuração operacional.
 * Não é Server Action. Integração comercial e ciclo de expiração/liberação ainda têm fluxo próprio.
 */
export async function reservarVagaMatriculaTx(tx: Prisma.TransactionClient, input: z.input<typeof Entrada>) {
  const d = Entrada.parse(input), entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${d.matriculaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${d.turmaId} FOR UPDATE`;
  const u = await tx.usuario.findUnique({ where: { id: d.autorId }, select: { ativo: true, papeis: true } });
  if (!u?.ativo || !u.papeis.some((p) => ["VENDEDOR", "GERENTE_COMERCIAL", "SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "ADMINISTRADOR"].includes(p))) throw new ErroPermissao();
  const existente = await tx.reservaVagaMatricula.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: d.autorId, chaveIdempotencia: d.chaveIdempotencia } } });
  if (existente) {
    if (existente.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada para outra reserva.");
    return { id: existente.id, status: existente.status, expiraEm: existente.expiraEm };
  }
  await tx.$queryRaw`SELECT id FROM "ConfiguracaoOperacional" WHERE id = 'escola' FOR SHARE`;
  const configuracao = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { prazoReservaMinutos: true } });
  const prazoMinutos = configuracao?.prazoReservaMinutos;
  if (!prazoMinutos || prazoMinutos < 1) throw new ErroRegra("Configure o prazo de reserva antes de iniciar uma nova reserva.");
  const matricula = await tx.matricula.findUnique({ where: { id: d.matriculaId }, include: { produto: true } });
  if (!matricula || !["RASCUNHO", "AGUARDANDO"].includes(matricula.status)) throw new ErroRegra("A reserva exige matrícula em preparação.");
  if (await tx.alocacaoTurma.count({ where: { matriculaId: matricula.id, ativa: true } })) throw new ErroRegra("Matrícula já possui alocação ativa; conferir sua movimentação.");
  if (await tx.reservaAgendaParticular.count({ where: { matriculaId: matricula.id, status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } } })) throw new ErroRegra("Matrícula já possui reserva de horários particulares.");
  if (await tx.reservaVagaMatricula.count({ where: { matriculaId: matricula.id, status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } } })) throw new ErroRegra("Matrícula já possui reserva que ocupa vaga.");
  const turma = await tx.turma.findUnique({ where: { id: d.turmaId }, include: { nivel: true } });
  if (!turma || turma.modalidadeId !== matricula.produto.modalidadeId || turma.nivel.idiomaId !== matricula.produto.idiomaId) throw new ErroRegra("Turma incompatível com o produto contratado.");
  const { janela, conferencia, agora } = await conferirTurmaParaReserva(tx, turma);
  if (!janela) throw new ErroRegra("Configure e aprove a janela de admissão antes de reservar.");
  if (!conferencia.elegivel) throw new ErroRegra(`Reserva indisponível: ${conferencia.impedimentos.join(", ")}.`);
  const expiraEm = new Date(agora.getTime() + prazoMinutos * 60000);
  if (!Number.isFinite(expiraEm.getTime())) throw new ErroRegra("Prazo de reserva fora do intervalo de datas suportado.");
  const r = await tx.reservaVagaMatricula.create({ data: { matriculaId: matricula.id, turmaId: turma.id, janelaId: janela.id, preparadorId: d.autorId,
    criadaEm: agora, expiraEm, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash } });
  await registrarEvento(tx, { tipo: "VagaMatriculaReservada", agregadoTipo: "Matricula", agregadoId: matricula.id, autorId: d.autorId,
    payload: { prazoMinutos, reservaId: r.id, turmaId: turma.id, janelaId: janela.id, expiraEm: r.expiraEm.toISOString() } });
  return { id: r.id, status: r.status, expiraEm: r.expiraEm };
}
