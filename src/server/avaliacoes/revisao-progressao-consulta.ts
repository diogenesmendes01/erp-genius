"use server";

import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { conferirGestorAvaliacao } from "./regras-tx";

const consultaSchema = z.object({ casoId: z.string().trim().min(1).max(100) }).strict();
const impactoSchema = z.object({ id: z.string(), status: z.enum(["APROVADA", "EXECUTADA"]) });
const contextoReposicaoSchema = z.object({ matriculaId: z.string(), nivelId: z.string(), alocacaoFonteId: z.string(), impactos: z.array(impactoSchema.extend({ turmaDestinoId: z.string(), decididoEm: z.string().nullable(), executadoEm: z.string().nullable() })) }).strict();
const impactosAulaSchema = z.object({
  progressao: z.array(contextoReposicaoSchema),
  comparacao: z.object({ registros: z.array(z.object({ matriculaId: z.string(), participacaoAlterada: z.boolean() }).passthrough()) }).passthrough(),
}).passthrough();
type FontesCaso = { decisaoCorrecaoConclusaoReposicaoId: string | null; aprovacaoCorrecaoAulaId: string | null };
type DecisaoReposicaoCaso = { id: string; reposicaoId: string; conclusaoVersao: number; matriculaId: string; contexto: unknown };
type AprovacaoAulaCaso = { id: string; encontroId: string; versaoAula: number; impactos: unknown };

/** Consulta institucional: não reutilizar no portal do aluno ou na Secretaria. */
export async function consultarCasoRevisaoProgressao(entrada: z.input<typeof consultaSchema>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = consultaSchema.parse(entrada);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await conferirGestorAvaliacao(tx, usuario.id);
      const caso = await tx.casoRevisaoProgressao.findUnique({ where: { id: d.casoId }, select: {
        id: true, criadaEm: true, matriculaId: true, alocacaoFonteId: true,
        decisaoCorrecaoNotaId: true, decisaoCorrecaoRecuperacaoId: true, snapshotImpacto: true,
        matricula: { select: { id: true, codigo: true, aluno: { select: { primeiroNome: true, sobrenome: true } } } },
        solicitacao: { select: { id: true, matriculaId: true, alocacaoOrigemId: true, status: true,
          turmaOrigem: { select: { nome: true, codigo: true } }, turmaDestino: { select: { nome: true, codigo: true } },
        } },
      } });
      if (!caso) throw new ErroRegra("Caso de revisão não encontrado.");
      const [fontesCaso] = await tx.$queryRaw<FontesCaso[]>`
        SELECT "decisaoCorrecaoConclusaoReposicaoId", "aprovacaoCorrecaoAulaId"
        FROM "CasoRevisaoProgressao" WHERE id = ${caso.id}
      `;
      const impacto = impactoSchema.parse(caso.snapshotImpacto);
      if (impacto.id !== caso.solicitacao.id || (caso.solicitacao.matriculaId
        ? caso.solicitacao.matriculaId !== caso.matriculaId
        : caso.solicitacao.alocacaoOrigemId !== caso.alocacaoFonteId)) {
        throw new ErroRegra("O vínculo da revisão precisa de conferência.");
      }
      const fontes = [caso.decisaoCorrecaoNotaId, caso.decisaoCorrecaoRecuperacaoId,
        fontesCaso?.decisaoCorrecaoConclusaoReposicaoId, fontesCaso?.aprovacaoCorrecaoAulaId].filter((id): id is string => !!id);
      if (fontes.length !== 1) {
        throw new ErroRegra("A fonte da revisão precisa de conferência.");
      }
      const decisaoId = fontes[0]!;
      let origem: { tipo: "REGULAR" | "RECUPERACAO" | "REPOSICAO" | "AULA"; decisaoId: string; alocacaoFonteId: string; reposicaoId?: string; conclusaoVersao?: number; labelReposicao?: string; encontroId?: string; versaoAula?: number; labelAula?: string };
      if (fontesCaso?.decisaoCorrecaoConclusaoReposicaoId) {
        const [decisaoReposicao] = await tx.$queryRaw<DecisaoReposicaoCaso[]>`
          SELECT d.id, r.id AS "reposicaoId", conclusao.versao AS "conclusaoVersao", r."matriculaId", d."contextoAcademico" AS contexto
          FROM "DecisaoCorrecaoConclusaoReposicao" d
          JOIN "CorrecaoConclusaoReposicaoIndividual" correcao ON correcao.id=d."correcaoId"
          JOIN "ConclusaoReposicaoIndividual" conclusao ON conclusao.id=correcao."conclusaoId"
          JOIN "ReposicaoIndividual" r ON r.id=conclusao."reposicaoId"
          WHERE d.id=${decisaoId}
        `;
        const contexto = decisaoReposicao && contextoReposicaoSchema.parse(decisaoReposicao.contexto);
        if (!decisaoReposicao || !contexto || decisaoReposicao.matriculaId !== caso.matriculaId || contexto.matriculaId !== caso.matriculaId || contexto.alocacaoFonteId !== caso.alocacaoFonteId) {
          throw new ErroRegra("O vínculo da revisão de reposição precisa de conferência.");
        }
        origem = { tipo: "REPOSICAO", decisaoId, alocacaoFonteId: caso.alocacaoFonteId, reposicaoId: decisaoReposicao.reposicaoId, conclusaoVersao: decisaoReposicao.conclusaoVersao, labelReposicao: `Conclusão da reposição — versão ${decisaoReposicao.conclusaoVersao}` };
      } else if (fontesCaso?.aprovacaoCorrecaoAulaId) {
        const [aprovacaoAula] = await tx.$queryRaw<AprovacaoAulaCaso[]>`
          SELECT aprovacao.id, proposta."encontroId" AS "encontroId", proposta.versao AS "versaoAula", aprovacao.impactos
          FROM "AprovacaoCorrecaoAula" aprovacao
          JOIN "PropostaCorrecaoAula" proposta ON proposta.id = aprovacao."propostaId"
          JOIN "EncontroAgenda" encontro ON encontro.id = proposta."encontroId"
          WHERE aprovacao.id = ${decisaoId}
        `;
        const impactosAula = aprovacaoAula && impactosAulaSchema.parse(aprovacaoAula.impactos);
        const contextos = impactosAula?.progressao.filter((contexto) => contexto.matriculaId === caso.matriculaId
          && contexto.alocacaoFonteId === caso.alocacaoFonteId) ?? [];
        const participacaoCorrigida = impactosAula?.comparacao.registros.some((registro) => registro.matriculaId === caso.matriculaId
          && registro.participacaoAlterada) ?? false;
        if (!aprovacaoAula || contextos.length !== 1 || !participacaoCorrigida
          || !contextos[0]!.impactos.some((item) => item.id === impacto.id && item.status === impacto.status)) {
          throw new ErroRegra("O vínculo da revisão de aula precisa de conferência.");
        }
        origem = { tipo: "AULA", decisaoId, alocacaoFonteId: caso.alocacaoFonteId,
          encontroId: aprovacaoAula.encontroId, versaoAula: aprovacaoAula.versaoAula,
          labelAula: `Correção de aula — versão ${aprovacaoAula.versaoAula}` };
      } else {
        origem = { tipo: caso.decisaoCorrecaoNotaId ? "REGULAR" : "RECUPERACAO", decisaoId, alocacaoFonteId: caso.alocacaoFonteId };
      }
      const resolucao = await tx.itemPropostaResolucaoRevisaoProgressao.findFirst({ where: {
        casoId: caso.id, proposta: { acao: { in: ["REGISTRAR_CANCELAMENTO", "RECONFIRMAR_EXECUTADA"] }, decisao: { aprovada: true } },
      }, select: { proposta: { select: { acao: true, decisao: { select: { decididaEm: true, motivo: true } } } } } });
      return {
        id: caso.id, criadaEm: caso.criadaEm, matricula: caso.matricula,
        origem,
        solicitacao: { id: caso.solicitacao.id, status: caso.solicitacao.status,
          turmaOrigem: caso.solicitacao.turmaOrigem, turmaDestino: caso.solicitacao.turmaDestino },
        statusNaCorrecao: impacto.status,
        // Só uma decisão terminal deste caso o resolve. Correções posteriores
        // criam outros casos e não herdam esta resolução.
        situacao: resolucao ? "RESOLVIDA" as const : "PENDENTE_REVISAO" as const,
        resolucao: resolucao?.proposta ?? null,
      };
    });
  });
}
