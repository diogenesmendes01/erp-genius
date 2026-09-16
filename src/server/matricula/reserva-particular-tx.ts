import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { AgendaParticularSchema, conferirAgendaParticularTx } from "./agenda-particular-estado";

const Entrada = AgendaParticularSchema.extend({ matriculaId: z.string().min(1), autorId: z.string().min(1),
  motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100),
  estadoHash: z.string().regex(/^[a-f0-9]{64}$/), horariosAcordadosConferidos: z.literal(true),
}).strict();

/** Primitiva interna; Comercial exige negociação no escopo atual. Não é Server Action.
 * Não ativa matrícula, não gera aula ou cobrança e não conclui Q111. */
export async function reservarAgendaParticularTx(tx: Prisma.TransactionClient, input: z.input<typeof Entrada>) {
  const d = Entrada.parse(input), entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await bloquearMatriculas(tx, [d.matriculaId]);
  const autor = await tx.usuario.findUnique({ where: { id: d.autorId }, select: { id: true, nome: true, ativo: true, papeis: true } });
  if (!autor?.ativo || !autor.papeis.some((p) => p === Papel.ADMINISTRADOR || p === Papel.SECRETARIA_ACADEMICA || p === Papel.VENDEDOR || p === Papel.GERENTE_COMERCIAL)) throw new ErroPermissao();
  const operacional = autor.papeis.includes(Papel.ADMINISTRADOR) || autor.papeis.includes(Papel.SECRETARIA_ACADEMICA);
  if (!operacional && !await tx.matricula.findFirst({ where: { id: d.matriculaId, lead: { is: await escopoComercialAtual(autor, tx) } }, select: { id: true } })) throw new ErroPermissao();
  const repetida = await tx.reservaAgendaParticular.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: d.autorId, chaveIdempotencia: d.chaveIdempotencia } } });
  if (repetida) {
    if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada para outra reserva particular.");
    return { id: repetida.id, status: repetida.status, expiraEm: repetida.expiraEm };
  }
  const m = await tx.matricula.findUnique({ where: { id: d.matriculaId } });
  if (!m || !["RASCUNHO", "AGUARDANDO"].includes(m.status)) throw new ErroRegra("Reserva exige matrícula em preparação.");
  if (await tx.alocacaoTurma.count({ where: { matriculaId: m.id, ativa: true } }) || await tx.reservaVagaMatricula.count({ where: { matriculaId: m.id, status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } } }) || await tx.reservaAgendaParticular.count({ where: { matriculaId: m.id, status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } } })) throw new ErroRegra("Matrícula já possui alocação ou reserva ativa.");
  const { matriculaId, autorId, motivo, chaveIdempotencia, estadoHash, horariosAcordadosConferidos, ...agenda } = d;
  const revisao = await conferirAgendaParticularTx(tx, agenda);
  const oferta = await tx.produtoPais.findUniqueOrThrow({ where: { id: d.ofertaId } });
  if (oferta.produtoId !== m.produtoId || oferta.paisId !== m.paisId || oferta.moeda !== m.moeda) throw new ErroRegra("Oferta incompatível com a matrícula.");
  if (revisao.snapshot.impedimentos.length) throw new ErroRegra(`Resolva os impedimentos: ${revisao.snapshot.impedimentos.join(", ")}.`);
  if (revisao.estadoHash !== estadoHash) throw new ErroRegra("A disponibilidade mudou. Confira os horários novamente.");
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${d.professorId} FOR SHARE`;
  const docente = await tx.usuario.findUnique({ where: { id: d.professorId }, select: { ativo: true, papeis: true } });
  if (!docente?.ativo || !docente.papeis.includes(Papel.PROFESSOR)) throw new ErroRegra("Professor indisponível.");
  await tx.$queryRaw`SELECT id FROM "ConfiguracaoOperacional" WHERE id = 'escola' FOR SHARE`;
  const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { prazoReservaMinutos: true } });
  if (!config?.prazoReservaMinutos || config.prazoReservaMinutos <= 0) throw new ErroRegra("Configure o prazo de reserva.");
  const criadaEm = new Date(), expiraEm = new Date(criadaEm.getTime() + config.prazoReservaMinutos * 60000);
  if (!Number.isFinite(expiraEm.getTime())) throw new ErroRegra("Prazo fora do intervalo suportado.");
  const r = await tx.reservaAgendaParticular.create({ data: { matriculaId, preparadorId: autorId, motivo, chaveIdempotencia, entradaHash,
    criadaEm, expiraEm, snapshot: revisao.snapshot, horarios: { create: revisao.snapshot.encontros.map((e) => ({ professorId: d.professorId, inicio: new Date(e.inicio), fim: new Date(e.fim), fusoOrigem: d.fusoOrigem })) } } });
  await registrarEvento(tx, { tipo: "AgendaParticularReservada", agregadoTipo: "Matricula", agregadoId: m.id, autorId,
    payload: { reservaId: r.id, formaAgenda: oferta.formaAgenda, estadoHash, horariosAcordadosConferidos, quantidade: revisao.snapshot.encontros.length, expiraEm: expiraEm.toISOString() } });
  return { id: r.id, status: r.status, expiraEm: r.expiraEm };
}
