import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirGestorAvaliacao } from "./regras-tx";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";

const id = z.string().min(1).max(100);
export const RevisarMigracaoSchema = z.object({ turmaId: id, destinoId: id }).strict();
export const ProporMigracaoSchema = RevisarMigracaoSchema.extend({
  estadoHash: z.string().regex(/^[a-f0-9]{64}$/), versaoEsperada: z.number().int().nonnegative(),
  motivo: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100),
}).strict();
export const DecidirMigracaoSchema = z.object({ propostaId: id, estadoHash: z.string().regex(/^[a-f0-9]{64}$/),
  aprovada: z.boolean(), motivo: z.string().trim().min(5).max(2000),
}).strict();
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

export async function bloquearMigracaoRegra(tx: Prisma.TransactionClient, turmaId: string, autorId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const t = await tx.turma.findUnique({ where: { id: turmaId }, select: { nivelId: true } });
  if (!t) throw new ErroRegra("Turma não encontrada.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`regra-avaliacao-nivel:${t.nivelId}`}, 0))`;
  await tx.$queryRaw`SELECT id FROM "Turma" WHERE id = ${turmaId} FOR UPDATE`;
  await conferirGestorAvaliacao(tx, autorId);
  const atual = await tx.turma.findUniqueOrThrow({ where: { id: turmaId }, select: { nivelId: true } });
  if (atual.nivelId !== t.nivelId) throw new ErroRegra("O nível da turma mudou. Atualize a conferência.");
}

/** Chamador precisa manter os locks do calendário, nível e turma. */
export async function contextoMigracaoRegra(tx: Prisma.TransactionClient, turmaId: string, destinoId: string) {
  if (await tx.registroAvaliacaoMatricula.count({ where: { turmaId } })) throw new ErroRegra("A turma possui registros de avaliação. Preserve as regras e confira o histórico antes de qualquer migração.");
  const t = await tx.turma.findUniqueOrThrow({ where: { id: turmaId }, select: {
    id: true, nome: true, codigo: true, nivelId: true, modalidadeId: true, professorId: true, status: true, dataInicio: true, dataFim: true, regraAvaliacaoId: true,
  } });
  const encontros = await tx.encontroAgenda.findMany({ where: { turmaId }, orderBy: { id: "asc" }, select: { id: true, inicio: true, fim: true, status: true, professorId: true } });
  const diarios = await tx.aulaDiario.count({ where: { turmaId } });
  const inicioRegistrado = await tx.evento.count({ where: { agregadoTipo: "Turma", agregadoId: turmaId, tipo: "TurmaEmAndamento" } });
  const publicados = encontros.filter(e => e.status === "PREVISTO" || e.status === "MINISTRADO");
  if (!["PLANEJADA", "ABERTA"].includes(t.status) || diarios || inicioRegistrado || publicados.some(e => e.status === "MINISTRADO" || e.inicio <= new Date()))
    throw new ErroRegra("A turma já iniciou ou possui histórico de aulas. Preserve a regra até concluir o nível.");
  if (!publicados.length && (!t.dataInicio || t.dataInicio <= new Date())) throw new ErroRegra("Sem agenda publicada futura, confira uma data de início futura antes de propor a regra.");
  const destino = await tx.versaoRegraAvaliacao.findUnique({ where: { id: destinoId }, include: { decisao: true } });
  const vigente = await tx.versaoRegraAvaliacao.findFirst({ where: { nivelId: t.nivelId, decisao: { aprovada: true } }, orderBy: { versao: "desc" } });
  if (!destino?.decisao?.aprovada || destino.nivelId !== t.nivelId || destino.id !== vigente?.id) throw new ErroRegra("Escolha a última regra publicada do mesmo nível.");
  const origem = t.regraAvaliacaoId ? await tx.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: t.regraAvaliacaoId } }) : null;
  if (origem && destino.versao <= origem.versao) throw new ErroRegra("A turma já usa essa versão ou uma mais recente.");
  const alocacoes = await tx.alocacaoTurma.findMany({ where: { turmaId }, orderBy: { id: "asc" }, select: { id: true, alunoId: true, matriculaId: true, ativa: true, criadoEm: true, encerradaEm: true } });
  const origemConteudo = origem ? ConteudoRegraAvaliacaoSchema.parse(origem.conteudo) : null;
  const destinoConteudo = ConteudoRegraAvaliacaoSchema.parse(destino.conteudo);
  const snapshot = {
    turma: { ...t, dataInicio: t.dataInicio?.toISOString() ?? null, dataFim: t.dataFim?.toISOString() ?? null },
    encontros: encontros.map(e => ({ ...e, inicio: e.inicio.toISOString(), fim: e.fim.toISOString() })),
    alocacoes: alocacoes.map(a => ({ ...a, criadoEm: a.criadoEm.toISOString(), encerradaEm: a.encerradaEm?.toISOString() ?? null })),
    origem: origem && origemConteudo ? { id: origem.id, versao: origem.versao, conteudo: origemConteudo } : null,
    destino: { id: destino.id, versao: destino.versao, conteudo: destinoConteudo },
  };
  const alteracoes = (Object.keys(destinoConteudo) as (keyof typeof destinoConteudo)[])
    .filter(campo => JSON.stringify(origemConteudo?.[campo]) !== JSON.stringify(destinoConteudo[campo]));
  return { snapshot, estadoHash: hash(snapshot), alteracoes };
}

export async function proporMigracaoRegraTx(tx: Prisma.TransactionClient, autorId: string, input: z.input<typeof ProporMigracaoSchema>) {
  const d = ProporMigracaoSchema.parse(input);
  // Calendário serializa também chaves entre turmas; conferir autoridade antes de replay.
  await bloquearMigracaoRegra(tx, d.turmaId, autorId);
  const anterior = await tx.propostaMigracaoRegraTurma.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autorId, chaveIdempotencia: d.chaveIdempotencia } } });
  if (anterior) {
    if (anterior.entradaHash !== hash(d)) throw new ErroRegra("Chave já utilizada com outra proposta.");
    return { id: anterior.id, versao: anterior.versao };
  }
  const c = await contextoMigracaoRegra(tx, d.turmaId, d.destinoId);
  if (c.estadoHash !== d.estadoHash) throw new ErroRegra("Os impactos mudaram. Revise novamente antes de propor.");
  const ultima = await tx.propostaMigracaoRegraTurma.findFirst({ where: { turmaId: d.turmaId }, orderBy: { versao: "desc" } });
  if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("Existe nova proposta. Atualize a revisão.");
  const p = await tx.propostaMigracaoRegraTurma.create({ data: { turmaId: d.turmaId, origemId: c.snapshot.origem?.id ?? null, destinoId: d.destinoId,
    preparadorId: autorId, versao: d.versaoEsperada + 1, snapshot: c.snapshot, estadoHash: c.estadoHash, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash(d) } });
  await registrarEvento(tx, { tipo: "MigracaoRegraTurmaProposta", agregadoTipo: "Turma", agregadoId: d.turmaId, autorId,
    payload: { propostaId: p.id, origemId: p.origemId, destinoId: p.destinoId, estadoHash: p.estadoHash, motivo: d.motivo } });
  return { id: p.id, versao: p.versao };
}

export async function decidirMigracaoRegraTx(tx: Prisma.TransactionClient, autorId: string, input: z.input<typeof DecidirMigracaoSchema>) {
  const d = DecidirMigracaoSchema.parse(input);
  const ref = await tx.propostaMigracaoRegraTurma.findUnique({ where: { id: d.propostaId }, select: { turmaId: true } });
  if (!ref) throw new ErroRegra("Proposta não encontrada.");
  await bloquearMigracaoRegra(tx, ref.turmaId, autorId);
  const p = await tx.propostaMigracaoRegraTurma.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true } });
  if (p.preparadorId === autorId) throw new ErroRegra("Outra pessoa da Gestão Pedagógica/Administração precisa decidir.");
  if (p.estadoHash !== d.estadoHash) throw new ErroRegra("Confira a versão exata dos impactos.");
  if (p.decisao) {
    if (p.decisao.decisorId === autorId && p.decisao.aprovada === d.aprovada && p.decisao.motivo === d.motivo) return { id: p.decisao.id, aplicada: p.decisao.aprovada };
    throw new ErroRegra("A proposta já possui decisão.");
  }
  if (d.aprovada) {
    const ultima = await tx.propostaMigracaoRegraTurma.findFirstOrThrow({ where: { turmaId: p.turmaId }, orderBy: { versao: "desc" } });
    if (ultima.id !== p.id) throw new ErroRegra("Confira a proposta mais recente.");
    const c = await contextoMigracaoRegra(tx, p.turmaId, p.destinoId);
    if (c.estadoHash !== p.estadoHash) throw new ErroRegra("Os impactos mudaram. Prepare outra proposta.");
  }
  // Trigger aplica a referência na mesma transação; não existe aprovação sem aplicação.
  const decisao = await tx.decisaoMigracaoRegraTurma.create({ data: { propostaId: p.id, decisorId: autorId, aprovada: d.aprovada, motivo: d.motivo } });
  await registrarEvento(tx, { tipo: d.aprovada ? "MigracaoRegraTurmaAplicada" : "MigracaoRegraTurmaRejeitada", agregadoTipo: "Turma", agregadoId: p.turmaId, autorId,
    payload: { propostaId: p.id, decisaoId: decisao.id, origemId: p.origemId, destinoId: p.destinoId, estadoHash: p.estadoHash, motivo: d.motivo } });
  return { id: decisao.id, aplicada: d.aprovada };
}
