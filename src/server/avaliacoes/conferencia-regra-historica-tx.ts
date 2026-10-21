import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirGestorAvaliacao } from "./regras-tx";

const id = z.string().min(1).max(100);
const texto = z.string().trim().min(5).max(2000);
const hash = (valor: unknown) => createHash("sha256").update(JSON.stringify(valor)).digest("hex");
export const RevisarConferenciaRegraHistoricaSchema = z.object({ turmaId: id, destinoId: id }).strict();
export const ProporConferenciaRegraHistoricaSchema = RevisarConferenciaRegraHistoricaSchema.extend({ estadoHash: z.string().regex(/^[a-f0-9]{64}$/), versaoEsperada: z.number().int().nonnegative(), motivo: texto, evidencia: texto, chaveIdempotencia: z.string().min(8).max(100) }).strict();
export const DecidirConferenciaRegraHistoricaSchema = z.object({ propostaId: id, estadoHash: z.string().regex(/^[a-f0-9]{64}$/), aprovada: z.boolean(), motivo: texto }).strict();

/** Mantém a mesma ordem de locks da migração Q141: calendário, nível, turma, papel. */
export async function bloquearConferenciaRegraHistorica(tx: Prisma.TransactionClient, turmaId: string, atorId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const turma = await tx.turma.findUnique({ where: { id: turmaId }, select: { nivelId: true } });
  if (!turma) throw new ErroRegra("Turma não encontrada.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`regra-avaliacao-nivel:${turma.nivelId}`}, 0))`;
  await tx.$queryRaw`SELECT id FROM "Turma" WHERE id=${turmaId} FOR UPDATE`;
  await conferirGestorAvaliacao(tx, atorId);
  return turma.nivelId;
}

/** Não seleciona a regra; apenas confere a versão publicada apontada pela evidência. */
export async function contextoConferenciaRegraHistorica(tx: Prisma.TransactionClient, turmaId: string, destinoId: string) {
  const turma = await tx.turma.findUniqueOrThrow({ where: { id: turmaId }, select: { id: true, nome: true, codigo: true, nivelId: true, status: true, dataInicio: true, dataFim: true, regraAvaliacaoId: true } });
  if (turma.regraAvaliacaoId) throw new ErroRegra("A turma já possui regra vinculada.");
  if (await tx.registroAvaliacaoMatricula.count({ where: { turmaId } })) throw new ErroRegra("A turma possui avaliações registradas; preserve o histórico.");
  const destino = await tx.versaoRegraAvaliacao.findUnique({ where: { id: destinoId }, include: { decisao: true } });
  if (!destino?.decisao?.aprovada || destino.nivelId !== turma.nivelId) throw new ErroRegra("Selecione uma versão publicada do mesmo nível.");
  const [encontros, diarios, alocacoes] = await Promise.all([
    tx.encontroAgenda.findMany({ where: { turmaId }, orderBy: { id: "asc" }, select: { id: true, inicio: true, fim: true, status: true, professorId: true } }),
    tx.aulaDiario.findMany({ where: { turmaId }, orderBy: { id: "asc" }, select: { id: true, ocorridaEm: true, professorId: true } }),
    tx.alocacaoTurma.findMany({ where: { turmaId }, orderBy: { id: "asc" }, select: { id: true, alunoId: true, matriculaId: true, ativa: true, criadoEm: true, encerradaEm: true, provenienciaVinculo: true, inicioVigencia: true, fimVigencia: true } }),
  ]);
  const snapshot = { turma: { ...turma, dataInicio: turma.dataInicio?.toISOString() ?? null, dataFim: turma.dataFim?.toISOString() ?? null }, destino: { id: destino.id, versao: destino.versao, conteudoHash: destino.conteudoHash, conteudo: destino.conteudo }, encontros: encontros.map(e => ({ ...e, inicio: e.inicio.toISOString(), fim: e.fim.toISOString() })), diarios: diarios.map(d => ({ ...d, ocorridaEm: d.ocorridaEm.toISOString() })), alocacoes: alocacoes.map(a => ({ ...a, criadoEm: a.criadoEm.toISOString(), encerradaEm: a.encerradaEm?.toISOString() ?? null, inicioVigencia: a.inicioVigencia?.toISOString() ?? null, fimVigencia: a.fimVigencia?.toISOString() ?? null })) };
  return { snapshot, estadoHash: hash(snapshot) };
}

export async function proporConferenciaRegraHistoricaTx(tx: Prisma.TransactionClient, atorId: string, input: z.input<typeof ProporConferenciaRegraHistoricaSchema>) {
  const d = ProporConferenciaRegraHistoricaSchema.parse(input); await bloquearConferenciaRegraHistorica(tx, d.turmaId, atorId);
  const anterior = await tx.propostaConferenciaRegraHistoricaTurma.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: atorId, chaveIdempotencia: d.chaveIdempotencia } } });
  if (anterior) { if (anterior.entradaHash !== hash(d)) throw new ErroRegra("Chave já utilizada com outra conferência."); return { id: anterior.id, versao: anterior.versao }; }
  const contexto = await contextoConferenciaRegraHistorica(tx, d.turmaId, d.destinoId);
  if (contexto.estadoHash !== d.estadoHash) throw new ErroRegra("A turma ou a versão mudaram. Revise novamente antes de propor.");
  const ultima = await tx.propostaConferenciaRegraHistoricaTurma.findFirst({ where: { turmaId: d.turmaId }, orderBy: { versao: "desc" }, select: { versao: true } });
  if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("Existe conferência mais recente.");
  const proposta = await tx.propostaConferenciaRegraHistoricaTurma.create({ data: { turmaId: d.turmaId, destinoId: d.destinoId, preparadorId: atorId, versao: d.versaoEsperada + 1, snapshot: contexto.snapshot, estadoHash: contexto.estadoHash, motivo: d.motivo, evidencia: d.evidencia, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash(d) } });
  await registrarEvento(tx, { tipo: "ConferenciaRegraHistoricaProposta", agregadoTipo: "Turma", agregadoId: d.turmaId, autorId: atorId, payload: { propostaId: proposta.id, destinoId: d.destinoId, estadoHash: proposta.estadoHash, motivo: d.motivo, evidencia: d.evidencia } });
  return { id: proposta.id, versao: proposta.versao };
}

export async function decidirConferenciaRegraHistoricaTx(tx: Prisma.TransactionClient, atorId: string, input: z.input<typeof DecidirConferenciaRegraHistoricaSchema>) {
  const d = DecidirConferenciaRegraHistoricaSchema.parse(input);
  const ref = await tx.propostaConferenciaRegraHistoricaTurma.findUnique({ where: { id: d.propostaId }, select: { turmaId: true } }); if (!ref) throw new ErroRegra("Conferência não encontrada.");
  await bloquearConferenciaRegraHistorica(tx, ref.turmaId, atorId);
  const proposta = await tx.propostaConferenciaRegraHistoricaTurma.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true } });
  if (proposta.preparadorId === atorId) throw new ErroRegra("Outra pessoa autorizada precisa decidir.");
  if (proposta.estadoHash !== d.estadoHash) throw new ErroRegra("Confira a revisão exata antes de decidir.");
  if (proposta.decisao) { if (proposta.decisao.decisorId === atorId && proposta.decisao.aprovada === d.aprovada && proposta.decisao.motivo === d.motivo) return { id: proposta.decisao.id, aplicada: proposta.decisao.aprovada }; throw new ErroRegra("Esta conferência já possui decisão."); }
  if (d.aprovada) { const ultima = await tx.propostaConferenciaRegraHistoricaTurma.findFirstOrThrow({ where: { turmaId: proposta.turmaId }, orderBy: { versao: "desc" }, select: { id: true } }); if (ultima.id !== proposta.id) throw new ErroRegra("Existe conferência mais recente."); const atual = await contextoConferenciaRegraHistorica(tx, proposta.turmaId, proposta.destinoId); if (atual.estadoHash !== proposta.estadoHash) throw new ErroRegra("A turma ou a versão mudaram. Prepare outra conferência."); }
  const decisao = await tx.decisaoConferenciaRegraHistoricaTurma.create({ data: { propostaId: proposta.id, decisorId: atorId, aprovada: d.aprovada, motivo: d.motivo } });
  await registrarEvento(tx, { tipo: d.aprovada ? "ConferenciaRegraHistoricaAplicada" : "ConferenciaRegraHistoricaRejeitada", agregadoTipo: "Turma", agregadoId: proposta.turmaId, autorId: atorId, payload: { propostaId: proposta.id, decisaoId: decisao.id, destinoId: proposta.destinoId, motivo: d.motivo } });
  return { id: decisao.id, aplicada: d.aprovada };
}
