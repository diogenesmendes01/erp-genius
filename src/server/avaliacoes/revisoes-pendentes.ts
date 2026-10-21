"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirGestorAvaliacao } from "./regras-tx";

const impactosSchema = z.array(z.object({ id: z.string(), status: z.enum(["APROVADA", "EXECUTADA"]), turmaDestinoId: z.string(), decididoEm: z.string().nullable(), executadoEm: z.string().nullable() }).strict());
const contextoReposicaoSchema = z.object({ matriculaId: z.string(), nivelId: z.string(), alocacaoFonteId: z.string(), impactos: impactosSchema }).strict();
const impactosAulaSchema = z.object({
  progressao: z.array(contextoReposicaoSchema),
  comparacao: z.object({ registros: z.array(z.object({ matriculaId: z.string(), participacaoAlterada: z.boolean() }).passthrough()) }).passthrough(),
}).passthrough();
const paginaSchema = z.object({ pagina: z.number().int().min(1).max(100000).default(1) }).strict();
type Tipo = "REGULAR" | "RECUPERACAO" | "REPOSICAO" | "AULA";
type Referencia = { id: string; tipo: Tipo };
type MatriculaResumo = { id: string; codigo: string | null; alunoId: string; aluno: { primeiroNome: string; sobrenome: string | null } };
type Normalizada = { id: string; tipo: Tipo; criadaEm: Date; motivo: string; decisor: string; propostaId: string | null; versaoCorrecao: number; lancamentoId: string | null; notaRecuperacaoId: string | null; reposicaoId: string | null; conclusaoVersao: number | null; labelReposicao: string | null; encontroId: string | null; versaoAula: number | null; labelAula: string | null; codigoAvaliacao: string | null; matricula: MatriculaResumo; alocacaoId: string; impactos: z.infer<typeof impactosSchema> };
type Caso = { id: string; matriculaId: string; solicitacaoId: string; decisaoCorrecaoNotaId: string | null; decisaoCorrecaoRecuperacaoId: string | null; decisaoCorrecaoConclusaoReposicaoId: string | null; aprovacaoCorrecaoAulaId: string | null };
type DecisaoReposicao = { id: string; criadaEm: Date; motivo: string; decisor: string; versaoCorrecao: number; reposicaoId: string; conclusaoVersao: number; matriculaId: string; codigo: string | null; alunoId: string; primeiroNome: string; sobrenome: string | null; contexto: unknown };
type AprovacaoAula = { id: string; criadaEm: Date; motivo: string; decisor: string; versaoCorrecao: number; encontroId: string; matriculaId: string; codigo: string | null; alunoId: string; primeiroNome: string; sobrenome: string | null; contexto: unknown; impactos: unknown };

/** Fila institucional: inclui correções aprovadas de nota, recuperação e reposição. */
export async function listarRevisoesPorCorrecao(input: { pagina?: number }) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO);
    const d = paginaSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      await conferirGestorAvaliacao(tx, usuario.id);
      const referencias = await tx.$queryRaw<Referencia[]>(Prisma.sql`
        SELECT id, tipo FROM (
          SELECT id, "criadaEm", 'REGULAR'::text AS tipo FROM "DecisaoCorrecaoNota" WHERE aprovada AND jsonb_array_length(impactos) > 0
          UNION ALL
          SELECT id, "criadaEm", 'RECUPERACAO'::text AS tipo FROM "DecisaoCorrecaoRecuperacao" WHERE aprovada AND jsonb_array_length(impactos->'mudancas') > 0
          UNION ALL
          SELECT id, "decididaEm" AS "criadaEm", 'REPOSICAO'::text AS tipo FROM "DecisaoCorrecaoConclusaoReposicao" WHERE aprovada AND jsonb_array_length("contextoAcademico"->'impactos') > 0
          UNION ALL
          SELECT aprovacao.id, aprovacao."criadaEm", 'AULA'::text AS tipo
          FROM "AprovacaoCorrecaoAula" aprovacao
          WHERE jsonb_typeof(aprovacao.impactos->'progressao') = 'array'
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(aprovacao.impactos->'progressao') contexto
              WHERE jsonb_typeof(contexto->'impactos') = 'array' AND jsonb_array_length(contexto->'impactos') > 0
                AND EXISTS (
                  SELECT 1 FROM jsonb_array_elements(aprovacao.impactos->'comparacao'->'registros') registro
                  WHERE registro->>'matriculaId' = contexto->>'matriculaId'
                    AND COALESCE((registro->>'participacaoAlterada')::boolean, false)
                )
            )
        ) correcoes ORDER BY "criadaEm" ASC, id ASC, tipo ASC OFFSET ${(d.pagina - 1) * 20} LIMIT 21
      `);
      const pagina = referencias.slice(0, 20);
      const ids = (tipo: Tipo) => pagina.filter((referencia) => referencia.tipo === tipo).map((referencia) => referencia.id);
      const [regulares, recuperacoes, reposicoes, aulas] = await Promise.all([
        tx.decisaoCorrecaoNota.findMany({
          where: { id: { in: ids("REGULAR") } },
          include: { decisor: { select: { nome: true } }, proposta: { include: { lancamento: { include: { registro: { include: { matricula: { include: { aluno: { select: { primeiroNome: true, sobrenome: true } } } } } } } } } } },
        }),
        tx.decisaoCorrecaoRecuperacao.findMany({
          where: { id: { in: ids("RECUPERACAO") } },
          include: { decisor: { select: { nome: true } }, proposta: { include: { notaOriginal: { include: { realizacao: { include: { itemReserva: { include: { reserva: { include: { proposta: { include: { matricula: { include: { aluno: { select: { primeiroNome: true, sobrenome: true } } } } } } } } } } } } } } } } },
        }),
        tx.$queryRaw<DecisaoReposicao[]>(Prisma.sql`
          SELECT d.id, d."decididaEm" AS "criadaEm", d.motivo, decisor.nome AS decisor, correcao.versao AS "versaoCorrecao", reposicao.id AS "reposicaoId", conclusao.versao AS "conclusaoVersao", matricula.id AS "matriculaId", matricula.codigo, aluno.id AS "alunoId", aluno."primeiroNome" AS "primeiroNome", aluno.sobrenome, d."contextoAcademico" AS contexto
          FROM "DecisaoCorrecaoConclusaoReposicao" d JOIN "CorrecaoConclusaoReposicaoIndividual" correcao ON correcao.id=d."correcaoId" JOIN "ConclusaoReposicaoIndividual" conclusao ON conclusao.id=correcao."conclusaoId" JOIN "ReposicaoIndividual" reposicao ON reposicao.id=conclusao."reposicaoId" JOIN "Matricula" matricula ON matricula.id=reposicao."matriculaId" JOIN "Aluno" aluno ON aluno.id=matricula."alunoId" JOIN "Usuario" decisor ON decisor.id=d."decisorId"
          WHERE d.id IN (${Prisma.join(ids("REPOSICAO").length ? ids("REPOSICAO") : ["__sem_decisao_reposicao__"])})
        `),
        tx.$queryRaw<AprovacaoAula[]>(Prisma.sql`
          SELECT aprovacao.id, aprovacao."criadaEm", aprovacao.motivo, decisor.nome AS decisor, proposta.versao AS "versaoCorrecao", proposta."encontroId" AS "encontroId",
            matricula.id AS "matriculaId", matricula.codigo, aluno.id AS "alunoId", aluno."primeiroNome" AS "primeiroNome", aluno.sobrenome,
            contexto.contexto, aprovacao.impactos
          FROM "AprovacaoCorrecaoAula" aprovacao
          JOIN "PropostaCorrecaoAula" proposta ON proposta.id=aprovacao."propostaId"
          JOIN "Usuario" decisor ON decisor.id=aprovacao."decisorId"
          JOIN LATERAL jsonb_array_elements(aprovacao.impactos->'progressao') contexto(contexto) ON true
          JOIN "Matricula" matricula ON matricula.id=contexto.contexto->>'matriculaId'
          JOIN "Aluno" aluno ON aluno.id=matricula."alunoId"
          WHERE aprovacao.id IN (${Prisma.join(ids("AULA").length ? ids("AULA") : ["__sem_aprovacao_aula__"])})
        `),
      ]);
      const normalizadas: Normalizada[] = [
        ...regulares.map((decisao) => { const registro = decisao.proposta.lancamento.registro; return { id: decisao.id, tipo: "REGULAR" as const, criadaEm: decisao.criadaEm, motivo: decisao.motivo, decisor: decisao.decisor.nome, propostaId: decisao.proposta.id, versaoCorrecao: decisao.proposta.versao, lancamentoId: decisao.proposta.lancamentoId, notaRecuperacaoId: null, reposicaoId: null, conclusaoVersao: null, labelReposicao: null, encontroId: null, versaoAula: null, labelAula: null, codigoAvaliacao: registro.codigoAvaliacao, matricula: registro.matricula, alocacaoId: registro.alocacaoId, impactos: impactosSchema.parse(decisao.impactos) }; }),
        ...recuperacoes.map((decisao) => { const item = decisao.proposta.notaOriginal.realizacao.itemReserva, plano = item.reserva.proposta; return { id: decisao.id, tipo: "RECUPERACAO" as const, criadaEm: decisao.criadaEm, motivo: decisao.motivo, decisor: decisao.decisor.nome, propostaId: decisao.proposta.id, versaoCorrecao: decisao.proposta.versao, lancamentoId: null, notaRecuperacaoId: decisao.proposta.notaId, reposicaoId: null, conclusaoVersao: null, labelReposicao: null, encontroId: null, versaoAula: null, labelAula: null, codigoAvaliacao: item.habilidade, matricula: plano.matricula, alocacaoId: plano.alocacaoId, impactos: z.object({ mudancas: impactosSchema }).parse(decisao.impactos).mudancas }; }),
        ...reposicoes.map((decisao) => { const contexto = contextoReposicaoSchema.parse(decisao.contexto); if (contexto.matriculaId !== decisao.matriculaId) throw new ErroRegra("O contexto acadêmico da correção de reposição não corresponde à matrícula."); return { id: decisao.id, tipo: "REPOSICAO" as const, criadaEm: decisao.criadaEm, motivo: decisao.motivo, decisor: decisao.decisor, propostaId: null, versaoCorrecao: decisao.versaoCorrecao, lancamentoId: null, notaRecuperacaoId: null, reposicaoId: decisao.reposicaoId, conclusaoVersao: decisao.conclusaoVersao, labelReposicao: `Conclusão da reposição — versão ${decisao.conclusaoVersao}`, encontroId: null, versaoAula: null, labelAula: null, codigoAvaliacao: null, matricula: { id: decisao.matriculaId, codigo: decisao.codigo, alunoId: decisao.alunoId, aluno: { primeiroNome: decisao.primeiroNome, sobrenome: decisao.sobrenome } }, alocacaoId: contexto.alocacaoFonteId, impactos: contexto.impactos }; }),
        ...aulas.flatMap((aprovacao) => {
          const contexto = contextoReposicaoSchema.parse(aprovacao.contexto);
          const impactos = impactosAulaSchema.parse(aprovacao.impactos);
          const contextosDaAprovacao = impactos.progressao.filter((item) => item.matriculaId === aprovacao.matriculaId
            && item.alocacaoFonteId === contexto.alocacaoFonteId && item.nivelId === contexto.nivelId);
          const participacaoCorrigida = impactos.comparacao.registros.some((registro) => registro.matriculaId === aprovacao.matriculaId && registro.participacaoAlterada);
          if (contextosDaAprovacao.length !== 1) {
            throw new ErroRegra("O contexto acadêmico da correção de aula não corresponde à matrícula.");
          }
          if (!participacaoCorrigida || !contexto.impactos.length) return [];
          return [{ id: aprovacao.id, tipo: "AULA" as const, criadaEm: aprovacao.criadaEm, motivo: aprovacao.motivo, decisor: aprovacao.decisor, propostaId: null, versaoCorrecao: aprovacao.versaoCorrecao, lancamentoId: null, notaRecuperacaoId: null, reposicaoId: null, conclusaoVersao: null, labelReposicao: null, encontroId: aprovacao.encontroId, versaoAula: aprovacao.versaoCorrecao, labelAula: `Correção de aula — versão ${aprovacao.versaoCorrecao}`, codigoAvaliacao: null, matricula: { id: aprovacao.matriculaId, codigo: aprovacao.codigo, alunoId: aprovacao.alunoId, aluno: { primeiroNome: aprovacao.primeiroNome, sobrenome: aprovacao.sobrenome } }, alocacaoId: contexto.alocacaoFonteId, impactos: contexto.impactos }];
        }),
      ];
      const impactoIds = normalizadas.flatMap((item) => item.impactos.map((impacto) => impacto.id));
      const casos = await tx.$queryRaw<Caso[]>(Prisma.sql`
        SELECT id, "matriculaId", "solicitacaoId", "decisaoCorrecaoNotaId", "decisaoCorrecaoRecuperacaoId", "decisaoCorrecaoConclusaoReposicaoId", "aprovacaoCorrecaoAulaId" FROM "CasoRevisaoProgressao"
        WHERE "decisaoCorrecaoNotaId" IN (${Prisma.join(ids("REGULAR").length ? ids("REGULAR") : ["__sem_decisao_regular__"])}) OR "decisaoCorrecaoRecuperacaoId" IN (${Prisma.join(ids("RECUPERACAO").length ? ids("RECUPERACAO") : ["__sem_decisao_recuperacao__"])}) OR "decisaoCorrecaoConclusaoReposicaoId" IN (${Prisma.join(ids("REPOSICAO").length ? ids("REPOSICAO") : ["__sem_decisao_reposicao__"])}) OR "aprovacaoCorrecaoAulaId" IN (${Prisma.join(ids("AULA").length ? ids("AULA") : ["__sem_aprovacao_aula__"])})
      `);
      const atuais = await tx.solicitacaoMudancaAcademica.findMany({ where: { id: { in: impactoIds } }, select: { id: true, alocacaoOrigemId: true, matriculaId: true, status: true, turmaDestino: { select: { nome: true, codigo: true, nivel: { select: { codigo: true, idioma: { select: { nome: true } } } } } } } });
      return { pagina: d.pagina, temProxima: referencias.length > 20, itens: pagina.flatMap((referencia) => normalizadas.filter((normalizada) => normalizada.id === referencia.id && normalizada.tipo === referencia.tipo)).map((item) => {
        return { id: item.id, tipo: item.tipo, criadaEm: item.criadaEm, motivo: item.motivo, decisor: item.decisor, propostaId: item.propostaId, versaoCorrecao: item.versaoCorrecao, lancamentoId: item.lancamentoId, notaRecuperacaoId: item.notaRecuperacaoId, reposicaoId: item.reposicaoId, conclusaoVersao: item.conclusaoVersao, labelReposicao: item.labelReposicao, encontroId: item.encontroId, versaoAula: item.versaoAula, labelAula: item.labelAula, codigoAvaliacao: item.codigoAvaliacao, matricula: item.matricula, impactos: item.impactos.map((impacto) => {
          const atual = atuais.find((solicitacao) => solicitacao.id === impacto.id && (solicitacao.matriculaId === item.matricula.id || (!solicitacao.matriculaId && solicitacao.alocacaoOrigemId === item.alocacaoId)));
          const caso = casos.find((existente) => existente.matriculaId === item.matricula.id && existente.solicitacaoId === impacto.id && (item.tipo === "REGULAR" ? existente.decisaoCorrecaoNotaId === item.id : item.tipo === "RECUPERACAO" ? existente.decisaoCorrecaoRecuperacaoId === item.id : item.tipo === "REPOSICAO" ? existente.decisaoCorrecaoConclusaoReposicaoId === item.id : existente.aprovacaoCorrecaoAulaId === item.id));
          return { casoId: caso?.id ?? null, solicitacaoId: impacto.id, statusNaCorrecao: impacto.status, statusAtual: atual?.status ?? null, destino: atual?.turmaDestino ?? null };
        }) };
      }) };
    });
  });
}

