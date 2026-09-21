"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { identificarMatriculaAvaliacao } from "./identificacao";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { estadoSegundaChamadaTx } from "./segunda-chamada-tx";

const schema = z.object({
  propostaId: z.string().min(1).max(100),
  depoisVersao: z.number().int().positive().optional(),
  busca: z.string().trim().max(100).default(""),
}).strict();

/** Projeção administrativa limitada à proposta e à avaliação que ela identifica. */
export async function consultarDesignacoesSegundaChamada(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR);
    const d = schema.parse(input);
    return prisma.$transaction(async tx => {
      const [proposta] = await tx.$queryRaw<{ id: string; alocacaoId: string; matriculaId: string; turmaId: string; regraId: string; codigoAvaliacao: string }[]>(Prisma.sql`
        SELECT p.id,p."alocacaoId" AS "alocacaoId",p."matriculaId" AS "matriculaId",p."turmaId" AS "turmaId",p."regraId" AS "regraId",p."codigoAvaliacao" AS "codigoAvaliacao"
        FROM "PropostaSegundaChamada" p
        JOIN "Turma" t ON t.id=p."turmaId" AND t."regraAvaliacaoId"=p."regraId"
        WHERE p.id=${d.propostaId}
        FOR UPDATE OF p
      `);
      if (!proposta) throw new ErroRegra("Proposta de segunda chamada não encontrada ou fora da regra atual.");
      const alocacao = await bloquearLancamento(tx, proposta.alocacaoId);
      if (alocacao.matriculaId !== proposta.matriculaId || alocacao.turmaId !== proposta.turmaId) throw new ErroRegra("Proposta fora do vínculo da matrícula e turma.");
      await conferirGestorAvaliacao(tx, usuario.id);

      const estado = await estadoSegundaChamadaTx(tx, proposta.alocacaoId, proposta.codigoAvaliacao);
      if (estado.regraId !== proposta.regraId || estado.matriculaId !== proposta.matriculaId || estado.turmaId !== proposta.turmaId) throw new ErroRegra("A proposta não corresponde à regra vigente da avaliação.");

      const atual = await tx.designacaoSegundaChamada.findFirst({
        where: { propostaId: proposta.id }, orderBy: { versao: "desc" },
        select: { id: true, versao: true, inicio: true, fim: true, motivo: true, criadaEm: true, professor: { select: { id: true, nome: true, ativo: true } } },
      });
      const historico = await tx.designacaoSegundaChamada.findMany({
        where: { propostaId: proposta.id, ...(d.depoisVersao ? { versao: { lt: d.depoisVersao } } : {}) },
        orderBy: { versao: "desc" }, take: 21,
        select: { id: true, versao: true, inicio: true, fim: true, motivo: true, criadaEm: true,
          professor: { select: { id: true, nome: true, ativo: true } }, gestor: { select: { nome: true } } },
      });
      const professores = await tx.usuario.findMany({
        where: { ativo: true, papeis: { has: Papel.PROFESSOR }, ...(d.busca ? { nome: { contains: d.busca, mode: "insensitive" as const } } : {}) },
        orderBy: [{ nome: "asc" }, { id: "asc" }], take: 51, select: { id: true, nome: true, ativo: true },
      });
      const [vigente] = await tx.$queryRaw<{ professorId: string | null }[]>(Prisma.sql`
        SELECT professor_segunda_chamada_no_instante(${proposta.id},clock_timestamp() AT TIME ZONE 'UTC') AS "professorId"
      `);
      const formato = (registro: { id: string; versao: number; inicio: Date; fim: Date | null; motivo: string; criadaEm: Date; professor: { id: string; nome: string; ativo: boolean } }) => ({
        id: registro.id, versao: registro.versao, professor: registro.professor, inicio: registro.inicio.toISOString(), fim: registro.fim?.toISOString() ?? null,
        motivo: registro.motivo, criadaEm: registro.criadaEm.toISOString(),
      });
      return {
        propostaId: proposta.id, codigoAvaliacao: proposta.codigoAvaliacao,
        identificacao: await identificarMatriculaAvaliacao(tx, proposta.matriculaId, proposta.turmaId),
        atual: atual ? formato(atual) : null, vigenteProfessorId: vigente?.professorId ?? null,
        historico: historico.slice(0, 20).map(registro => ({ ...formato(registro), gestor: { nome: registro.gestor.nome } })),
        proximaVersao: historico.length > 20 ? historico[19].versao : null,
        professores: professores.slice(0, 50), refinarBusca: professores.length > 50, busca: d.busca,
        podeDesignar: estado.pendente,
      };
    });
  });
}
