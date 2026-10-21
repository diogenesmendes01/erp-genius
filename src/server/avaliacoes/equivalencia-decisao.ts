"use server";

import { randomUUID } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { APROVADORES_ACADEMICOS, bloquearEstadoAcademico, exigirUsuarioAcademicoAtual } from "@/server/academico/estado";
import { EntradaEquivalenciaTransferenciaSchema } from "./equivalencia-transferencia";
import { conferirEstadoEquivalenciaTx, estadosEquivalenciaCorrespondemNoMarco } from "./equivalencia-estado-tx";

const id = z.string().trim().min(1).max(100);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const decisaoSchema = z.object({
  propostaId: id,
  estadoHash: hash,
  aprovar: z.boolean(),
  motivo: z.string().trim().min(5).max(2000),
}).strict();
const snapshotSchema = z.object({ estadoHash: hash }).passthrough();

/**
 * A proposta é imutável, mas a decisão precisa serializar com uma nova versão
 * do mesmo contexto. O lock acadêmico vem antes da releitura da proposta para
 * não autorizar uma decisão com o aluno, matrícula ou turma já alterados.
 */
async function bloquearPropostaEquivalencia(tx: Prisma.TransactionClient, propostaId: string) {
  const referencia = await tx.propostaEquivalenciaAvaliacao.findUnique({
    where: { id: propostaId },
    select: { matriculaId: true, alocacaoOrigemId: true, turmaDestinoId: true },
  });
  if (!referencia) throw new ErroRegra("Proposta de equivalência não encontrada.");
  const matricula = await tx.matricula.findUnique({ where: { id: referencia.matriculaId }, select: { alunoId: true } });
  if (!matricula) throw new ErroRegra("A matrícula da proposta não existe mais.");

  await bloquearEstadoAcademico(tx, matricula.alunoId, referencia.turmaDestinoId);
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtextextended(
      ${`equivalencia-avaliacao:${referencia.matriculaId}:${referencia.alocacaoOrigemId}:${referencia.turmaDestinoId}`}, 0))
  `);
  await tx.$queryRaw`SELECT id FROM "PropostaEquivalenciaAvaliacao" WHERE id=${propostaId} FOR SHARE`;

  const proposta = await tx.propostaEquivalenciaAvaliacao.findUnique({
    where: { id: propostaId },
    include: { decisao: true },
  });
  if (!proposta || proposta.matriculaId !== referencia.matriculaId
    || proposta.alocacaoOrigemId !== referencia.alocacaoOrigemId || proposta.turmaDestinoId !== referencia.turmaDestinoId) {
    throw new ErroRegra("A proposta mudou durante a conferência. Atualize a página.");
  }
  return { proposta, alunoId: matricula.alunoId };
}

function estadoHashDaProposta(snapshot: Prisma.JsonValue) {
  const resultado = snapshotSchema.safeParse(snapshot);
  if (!resultado.success) throw new ErroRegra("A proposta não possui uma conferência válida. Prepare uma nova versão.");
  return resultado.data.estadoHash;
}

/**
 * Q153: decisão independente da gestão. Aprovação só sobrevive com fontes,
 * regras e alocação ainda atuais; rejeição preserva a proposta histórica mesmo
 * quando o estado operacional posterior já não permite aplicá-la.
 */
export async function decidirEquivalenciaTransferencia(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const dados = decisaoSchema.parse(input);
    return prisma.$transaction(async tx => {
      const { proposta: p } = await bloquearPropostaEquivalencia(tx, dados.propostaId);
      await exigirUsuarioAcademicoAtual(tx, autor.id, APROVADORES_ACADEMICOS);
      if (p.preparadorId === autor.id) throw new ErroRegra("Outra pessoa da gestão deve decidir a equivalência.");

      const estadoHashProposta = estadoHashDaProposta(p.snapshot);
      if (dados.estadoHash !== estadoHashProposta) throw new ErroRegra("Atualize a proposta antes de decidir.");

      if (p.decisao) {
        if (p.decisao.decisorId === autor.id && p.decisao.aprovada === dados.aprovar && p.decisao.motivo === dados.motivo) {
          return { id: p.decisao.id, aprovada: p.decisao.aprovada };
        }
        throw new ErroRegra("A proposta já foi decidida.");
      }

      if (dados.aprovar) {
        // A aprovação faz o proponente voltar a passar pela autorização atual.
        // A rejeição continua possível para encerrar a proposta histórica mesmo
        // se ele já não estiver ativo ou se o contexto tiver sido superado.
        await exigirUsuarioAcademicoAtual(tx, p.preparadorId, APROVADORES_ACADEMICOS);
        const mapeamentos = EntradaEquivalenciaTransferenciaSchema.shape.mapeamentos.safeParse(p.mapeamentos);
        if (!mapeamentos.success) throw new ErroRegra("Os mapeamentos preservados na proposta não são válidos. Prepare nova versão.");
        const ultima = await tx.propostaEquivalenciaAvaliacao.findFirst({
          where: { matriculaId: p.matriculaId, alocacaoOrigemId: p.alocacaoOrigemId, turmaDestinoId: p.turmaDestinoId },
          orderBy: { versao: "desc" }, select: { id: true },
        });
        if (ultima?.id !== p.id) throw new ErroRegra("Proposta superada; confira a versão mais recente.");

        const agora = new Date();
        const atual = await conferirEstadoEquivalenciaTx(tx, {
          matriculaId: p.matriculaId,
          alocacaoOrigemId: p.alocacaoOrigemId,
          turmaDestinoId: p.turmaDestinoId,
          mapeamentos: mapeamentos.data,
          agora,
        });
        const c = atual.snapshot.contexto;
        if ((atual.estadoHash !== estadoHashProposta && !estadosEquivalenciaCorrespondemNoMarco(p.snapshot, atual.snapshot, agora))
          || c.turmaOrigemId !== p.turmaOrigemId || c.turmaDestinoId !== p.turmaDestinoId
          || c.regraOrigemId !== p.regraOrigemId || c.regraDestinoId !== p.regraDestinoId
          || c.matriculaId !== p.matriculaId || c.alocacaoOrigemId !== p.alocacaoOrigemId) {
          throw new ErroRegra("As fontes, regras ou contexto mudaram. Prepare uma nova proposta antes de aprovar.");
        }
      }

      const decisao = await tx.decisaoEquivalenciaAvaliacao.create({
        data: { id: randomUUID(), propostaId: p.id, decisorId: autor.id, aprovada: dados.aprovar, motivo: dados.motivo },
      });
      await registrarEvento(tx, {
        tipo: "EquivalenciaAvaliacaoDecidida", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: autor.id,
        payload: { propostaId: p.id, decisaoId: decisao.id, aprovada: dados.aprovar, motivo: dados.motivo,
          alocacaoOrigemId: p.alocacaoOrigemId, turmaDestinoId: p.turmaDestinoId },
      });
      return { id: decisao.id, aprovada: decisao.aprovada };
    });
  });
}
