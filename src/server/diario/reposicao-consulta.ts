"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, ErroRegra, executarAcao, exigirSessaoComPapel } from "@/server/_shared";

const porMatricula = z.object({ matriculaId: z.string().min(1), cursor: z.string().min(1).optional(), origemCursor: z.string().min(1).optional(), limite: z.number().int().min(1).max(100).default(30) }).strict();
const filtroFila = z.object({ cursor: z.string().min(1).optional(), limite: z.number().int().min(1).max(100).default(30) }).strict();

type LinhaEquipe = {
  id: string; modalidade: "PARTICULAR" | "GRAVACAO"; solicitadaEm: Date; solicitante: string; solicitanteId: string; motivo: string; evidencia: string;
  aulaOriginalId: string; inicio: Date; fim: Date; fuso: string; turma: string | null; participacao: "PRESENTE" | "FALTA" | "IMPEDIDO_POR_RESTRICAO";
  decisaoId: string | null; aprovada: boolean | null; motivoDecisao: string | null; decididaEm: Date | null; decisor: string | null;
  concluida: boolean | null; dataResultado: Date | null; versaoConclusao: number | null;
};

type LinhaCicloAgenda = {
  reposicaoId: string; agendaId: string; encontroId: string; professorId: string | null; fusoOrigem: string; statusBeneficio: "RESERVADA" | "CONSUMIDA" | "DEVOLVIDA" | "ISENTA_EXCECAO"; encontroStatus: string;
  cancelamentoId: string | null; cancelamentoAutorId: string | null; remarcacaoId: string | null; remarcacaoAutorId: string | null;
};

type LinhaAutorizacaoExcecao = { reposicaoId: string; id: string; motivo: string; decididaEm: Date };
type LinhaProfessorAgenda = { id: string; nome: string };
type LinhaExcecaoAgenda = {
  reposicaoId: string; id: string; professor: string; inicio: Date; fim: Date; fuso: string; motivo: string; evidencia: string;
  solicitanteId: string; solicitante: string; criadaEm: Date; versao: number;
  decisaoId: string | null; aprovada: boolean | null; motivoDecisao: string | null; decididaEm: Date | null; decisor: string | null;
};

type LinhaOrigem = { aulaOriginalId: string; inicio: Date; fim: Date; fuso: string; turma: string | null; participacao: "PRESENTE" | "FALTA" | "IMPEDIDO_POR_RESTRICAO" };

type LinhaDocente = {
  id: string; matriculaId: string; modalidade: "PARTICULAR" | "GRAVACAO"; aulaOriginalId: string; inicio: Date; fim: Date; fuso: string; participacao: "PRESENTE" | "FALTA" | "IMPEDIDO_POR_RESTRICAO";
  versaoAnterior: number; entregaId: string | null; entregueEm: Date | null; resumo: string | null; atividade: string | null; evidenciaEntrega: string | null;
  encontroReposicaoId: string | null; encontroReposicaoInicio: Date | null; encontroReposicaoFim: Date | null; encontroReposicaoFuso: string | null; encontroReposicaoStatus: string | null; participacaoReposicao: "PRESENTE" | "FALTA" | "IMPEDIDO_POR_RESTRICAO" | null;
};


function temEquipe(papeis: string[]) {
  const permitidos: string[] = [Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR];
  return papeis.some((papel) => permitidos.includes(papel));
}

/** Q10/Q11/Q27: histórico e origens da mesma matrícula, sem ficha, contato ou financeiro. */
export async function consultarReposicoesEquipe(input: z.input<typeof porMatricula>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = porMatricula.parse(input);
    return prisma.$transaction(async (tx) => {
      const [fresco] = await tx.$queryRaw<{ ativo: boolean; papeis: string[] }[]>(Prisma.sql`
        SELECT ativo, papeis FROM "Usuario" WHERE id = ${usuario.id} FOR SHARE
      `);
      if (!fresco?.ativo || !temEquipe(fresco.papeis)) throw new ErroPermissao();
      const [matricula] = await tx.$queryRaw<{ id: string; codigo: string | null; status: string }[]>(Prisma.sql`
        SELECT id, codigo, status::text AS status FROM "Matricula" WHERE id = ${d.matriculaId} FOR SHARE
      `);
      if (!matricula) throw new ErroRegra("Matrícula indisponível para consulta.");

      await tx.$queryRaw(Prisma.sql`SELECT id FROM "ReposicaoIndividual" WHERE "matriculaId" = ${matricula.id} FOR SHARE`);
      const [reposicoes, origens] = await Promise.all([
        tx.$queryRaw<LinhaEquipe[]>(Prisma.sql`
          SELECT r.id, r.modalidade::text AS modalidade, r."criadaEm" AS "solicitadaEm", solicitante.nome AS solicitante,
            r."solicitanteId" AS "solicitanteId", r.motivo, r.evidencia, r."aulaOriginalId" AS "aulaOriginalId",
            original.inicio, original.fim, original."fusoOrigem" AS fuso, COALESCE(turma.codigo, turma.nome) AS turma,
            participacao_aula_efetiva(registro.id)::text AS participacao,
            decisao.id AS "decisaoId", decisao.aprovada, decisao.motivo AS "motivoDecisao", decisao."decididaEm" AS "decididaEm", decisor.nome AS decisor,
            conclusao.concluida, COALESCE(conclusao."realizadaEm", conclusao."validadaEm") AS "dataResultado", conclusao.versao AS "versaoConclusao"
          FROM "ReposicaoIndividual" r
          JOIN "EncontroAgenda" original ON original.id = r."aulaOriginalId"
          JOIN "AulaDiario" diario ON diario."encontroId" = original.id
          JOIN "RegistroAulaAluno" registro ON registro."aulaId" = diario.id AND registro."matriculaId" = r."matriculaId"
          LEFT JOIN "Turma" turma ON turma.id = original."turmaId"
          JOIN "Usuario" solicitante ON solicitante.id = r."solicitanteId"
          LEFT JOIN "DecisaoReposicaoIndividual" decisao ON decisao."reposicaoId" = r.id
          LEFT JOIN "Usuario" decisor ON decisor.id = decisao."decisorId"
          LEFT JOIN LATERAL (
            SELECT CASE WHEN correcao.id IS NOT NULL THEN correcao.concluida ELSE c.concluida END AS concluida,
              CASE WHEN correcao.id IS NOT NULL THEN correcao."realizadaEm" ELSE c."realizadaEm" END AS "realizadaEm",
              CASE WHEN correcao.id IS NOT NULL THEN correcao."validadaEm" ELSE c."validadaEm" END AS "validadaEm",
              c.versao AS versao
            FROM "ConclusaoReposicaoIndividual" c
            LEFT JOIN LATERAL (
              SELECT correcao.* FROM "CorrecaoConclusaoReposicaoIndividual" correcao
              JOIN "DecisaoCorrecaoConclusaoReposicao" decisaoCorrecao ON decisaoCorrecao."correcaoId" = correcao.id AND decisaoCorrecao.aprovada = true
              WHERE correcao."conclusaoId" = c.id ORDER BY correcao.versao DESC, correcao.id DESC LIMIT 1
            ) correcao ON true
            WHERE c."reposicaoId" = r.id
            ORDER BY c.versao DESC, c.id DESC LIMIT 1
          ) conclusao ON true
          WHERE r."matriculaId" = ${matricula.id}
            AND (${d.cursor ?? null}::text IS NULL OR (r."criadaEm", r.id) < (
              SELECT cursor."criadaEm", cursor.id FROM "ReposicaoIndividual" cursor
              WHERE cursor.id = ${d.cursor ?? ""} AND cursor."matriculaId" = ${matricula.id}
            ))
          ORDER BY r."criadaEm" DESC, r.id DESC
          LIMIT ${d.limite + 1}
        `),
        tx.$queryRaw<LinhaOrigem[]>(Prisma.sql`
          SELECT original.id AS "aulaOriginalId", original.inicio, original.fim, original."fusoOrigem" AS fuso,
            COALESCE(turma.codigo, turma.nome) AS turma, participacao_aula_efetiva(registro.id)::text AS participacao
          FROM "EncontroAgenda" original
          JOIN "AulaDiario" diario ON diario."encontroId" = original.id
          JOIN "RegistroAulaAluno" registro ON registro."aulaId" = diario.id AND registro."matriculaId" = ${matricula.id}
          LEFT JOIN "Turma" turma ON turma.id = original."turmaId"
          WHERE original.finalidade = 'AULA'::"FinalidadeEncontroAgenda" AND original."turmaId" IS NOT NULL
            AND original.status = 'MINISTRADO'::"StatusEncontroAgenda" AND original.fim <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
            AND participacao_aula_efetiva(registro.id) IN ('FALTA'::"ParticipacaoAula", 'IMPEDIDO_POR_RESTRICAO'::"ParticipacaoAula")
            AND NOT EXISTS (
              SELECT 1 FROM "ReposicaoIndividual" r
              LEFT JOIN "DecisaoReposicaoIndividual" decisao ON decisao."reposicaoId" = r.id
              LEFT JOIN "AgendaReposicaoIndividual" agenda ON agenda."reposicaoId"=r.id
              LEFT JOIN "EncontroAgenda" encontroReposicao ON encontroReposicao.id=agenda."encontroId"
              LEFT JOIN "AulaDiario" diarioReposicao ON diarioReposicao."encontroId"=encontroReposicao.id
              LEFT JOIN "RegistroAulaAluno" tentativa ON tentativa."aulaId"=diarioReposicao.id AND tentativa."matriculaId"=r."matriculaId"
              LEFT JOIN "ConclusaoReposicaoIndividual" conclusaoReposicao ON conclusaoReposicao."reposicaoId"=r.id
              WHERE r."matriculaId" = ${matricula.id} AND r."aulaOriginalId" = original.id
                AND (decisao.aprovada IS FALSE OR (agenda."statusBeneficio"='CONSUMIDA'::"StatusReservaBeneficioReposicao" AND tentativa.participacao='FALTA'::"ParticipacaoAula" AND conclusaoReposicao.id IS NULL)) IS NOT TRUE
            )
            AND (${d.origemCursor ?? null}::text IS NULL OR (original.inicio, original.id) < (
              SELECT cursor.inicio, cursor.id FROM "EncontroAgenda" cursor
              JOIN "AulaDiario" diarioCursor ON diarioCursor."encontroId" = cursor.id
              JOIN "RegistroAulaAluno" registroCursor ON registroCursor."aulaId" = diarioCursor.id AND registroCursor."matriculaId" = ${matricula.id}
              WHERE cursor.id = ${d.origemCursor ?? ""} AND cursor.finalidade = 'AULA'::"FinalidadeEncontroAgenda"
            ))
          ORDER BY original.inicio DESC, original.id DESC
          LIMIT ${d.limite + 1}
        `),
      ]);
      const pagina = reposicoes.slice(0, d.limite);
      const paginaOrigens = origens.slice(0, d.limite);
      // 185 ainda pode estar pendente de integração. A leitura condicional
      // mantém o histórico de frequência disponível antes da migration.
      const [cicloInstalado] = await tx.$queryRaw<{ instalado: boolean }[]>(Prisma.sql`
        SELECT to_regclass('public."PropostaCancelamentoAgendaReposicaoIndividual"') IS NOT NULL
          AND to_regclass('public."PropostaRemarcacaoAgendaReposicaoIndividual"') IS NOT NULL AS instalado
      `);
      const ciclos = cicloInstalado?.instalado ? await tx.$queryRaw<LinhaCicloAgenda[]>(Prisma.sql`
        SELECT a."reposicaoId" AS "reposicaoId",a.id AS "agendaId",a."encontroId" AS "encontroId",e."professorId" AS "professorId",e."fusoOrigem" AS "fusoOrigem",
          a."statusBeneficio"::text AS "statusBeneficio",e.status::text AS "encontroStatus",
          cancelamento.id AS "cancelamentoId",cancelamento."autorId" AS "cancelamentoAutorId",
          remarcacao.id AS "remarcacaoId",remarcacao."autorId" AS "remarcacaoAutorId"
        FROM "AgendaReposicaoIndividual" a JOIN "EncontroAgenda" e ON e.id=a."encontroId"
        LEFT JOIN LATERAL (
          SELECT p.id,p."autorId" FROM "PropostaCancelamentoAgendaReposicaoIndividual" p
          LEFT JOIN "DecisaoCancelamentoAgendaReposicaoIndividual" d ON d."propostaId"=p.id
          WHERE p."agendaId"=a.id AND d.id IS NULL ORDER BY p.versao DESC LIMIT 1
        ) cancelamento ON true
        LEFT JOIN LATERAL (
          SELECT p.id,p."autorId" FROM "PropostaRemarcacaoAgendaReposicaoIndividual" p
          LEFT JOIN "DecisaoRemarcacaoAgendaReposicaoIndividual" d ON d."propostaId"=p.id
          WHERE p."agendaId"=a.id AND d.id IS NULL ORDER BY p.versao DESC LIMIT 1
        ) remarcacao ON true
        WHERE a."reposicaoId" IN (${Prisma.join(pagina.map((r) => r.id).length ? pagina.map((r) => r.id) : ["__sem_reposicao__"])})
      `) : [];
      const cicloPorReposicao = new Map(ciclos.map((c) => [c.reposicaoId, c]));
      const idsPagina = pagina.map((r) => r.id);
      const [operacao, professores, autorizacoes, excecoesAgenda] = await Promise.all([
        tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } }),
        tx.$queryRaw<LinhaProfessorAgenda[]>(Prisma.sql`
          SELECT id,nome FROM "Usuario" WHERE ativo AND 'PROFESSOR' = ANY(papeis) ORDER BY nome ASC, id ASC
        `),
        tx.$queryRaw<LinhaAutorizacaoExcecao[]>(Prisma.sql`
          SELECT a."reposicaoId" AS "reposicaoId",a.id,a.motivo,decisao."decididaEm" AS "decididaEm"
          FROM "AutorizacaoExcecaoReposicaoParticular" a
          JOIN "DecisaoAutorizacaoExcecaoReposicaoParticular" decisao ON decisao."autorizacaoId"=a.id AND decisao.aprovada
          WHERE a."reposicaoId" IN (${Prisma.join(idsPagina.length ? idsPagina : ["__sem_reposicao__"])})
          ORDER BY decisao."decididaEm" DESC, a.id DESC
        `),
        tx.$queryRaw<LinhaExcecaoAgenda[]>(Prisma.sql`
          SELECT x."reposicaoId" AS "reposicaoId", x.id, professor.nome AS professor, x.inicio, x.fim,
            x."fusoOrigem" AS fuso, x.motivo, x.evidencia, x."solicitanteId" AS "solicitanteId",
            solicitante.nome AS solicitante, x."criadaEm" AS "criadaEm", x.versao,
            decisao.id AS "decisaoId", decisao.aprovada, decisao.motivo AS "motivoDecisao",
            decisao."decididaEm" AS "decididaEm", decisor.nome AS decisor
          FROM "ExcecaoAgendaReposicaoIndividual" x
          JOIN "Usuario" professor ON professor.id=x."professorId"
          JOIN "Usuario" solicitante ON solicitante.id=x."solicitanteId"
          LEFT JOIN "DecisaoExcecaoAgendaReposicaoIndividual" decisao ON decisao."excecaoId"=x.id
          LEFT JOIN "Usuario" decisor ON decisor.id=decisao."decisorId"
          WHERE x."reposicaoId" IN (${Prisma.join(idsPagina.length ? idsPagina : ["__sem_reposicao__"])})
          ORDER BY x."criadaEm" DESC, x.id DESC
        `),
      ]);
      const autorizacoesPorReposicao = new Map<string, LinhaAutorizacaoExcecao[]>();
      for (const autorizacao of autorizacoes) {
        const lista = autorizacoesPorReposicao.get(autorizacao.reposicaoId) ?? [];
        lista.push(autorizacao); autorizacoesPorReposicao.set(autorizacao.reposicaoId, lista);
      }
      const excecoesPorReposicao = new Map<string, LinhaExcecaoAgenda[]>();
      for (const excecao of excecoesAgenda) {
        const lista = excecoesPorReposicao.get(excecao.reposicaoId) ?? [];
        lista.push(excecao); excecoesPorReposicao.set(excecao.reposicaoId, lista);
      }
      const podeAgendar = matricula.status === "ATIVA" && fresco.papeis.some((papel) => papel === Papel.SECRETARIA_ACADEMICA || papel === Papel.ADMINISTRADOR);
      const podeGerirExcecao = fresco.papeis.some((papel) => papel === Papel.GERENTE_PEDAGOGICO || papel === Papel.ADMINISTRADOR);
      return {
        matricula: { id: matricula.id, codigo: matricula.codigo ?? "Sem código", ativa: matricula.status === "ATIVA" },
        origensElegiveis: paginaOrigens.map((o) => ({ ...o, inicio: o.inicio.toISOString(), fim: o.fim.toISOString() })),
        reposicoes: pagina.map((r) => ({
          id: r.id, modalidade: r.modalidade,
          origem: { aulaOriginalId: r.aulaOriginalId, matriculaId: matricula.id, participacao: r.participacao, inicio: r.inicio.toISOString(), fim: r.fim.toISOString(), fuso: r.fuso, turma: r.turma },
          solicitadaEm: r.solicitadaEm.toISOString(), solicitadaPor: r.solicitante, motivo: r.motivo, evidencia: r.evidencia,
          decisao: r.decisaoId ? { aprovada: !!r.aprovada, motivo: r.motivoDecisao ?? "", decididaEm: r.decididaEm!.toISOString(), decisor: r.decisor ?? "Pessoa autorizada" } : null,
          conclusao: r.versaoConclusao === null ? null : { concluida: !!r.concluida, dataResultado: r.dataResultado?.toISOString() ?? null, versao: r.versaoConclusao },
          podeDecidir: matricula.status === "ATIVA" && !r.decisaoId && r.solicitanteId !== usuario.id && fresco.papeis.some((p) => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR),
          cicloAgenda: cicloPorReposicao.get(r.id) ?? null,
          agendaInicial: r.modalidade === "PARTICULAR" && !!r.aprovada && !cicloPorReposicao.has(r.id) && podeAgendar ? {
            fuso: operacao?.fusoInstitucional ?? null,
            professores,
            autorizacoesExcepcionais: (autorizacoesPorReposicao.get(r.id) ?? []).map((a) => ({ id: a.id, motivo: a.motivo, decididaEm: a.decididaEm.toISOString() })),
          } : null,
          excecoesAgenda: (excecoesPorReposicao.get(r.id) ?? []).map((x) => ({
            id: x.id, professor: x.professor, inicio: x.inicio.toISOString(), fim: x.fim.toISOString(), fuso: x.fuso,
            motivo: x.motivo, evidencia: x.evidencia, solicitante: x.solicitante, criadaEm: x.criadaEm.toISOString(), versao: x.versao,
            decisao: x.decisaoId ? { aprovada: !!x.aprovada, motivo: x.motivoDecisao ?? "", decididaEm: x.decididaEm!.toISOString(), decisor: x.decisor ?? "Pessoa autorizada" } : null,
            podeDecidir: matricula.status === "ATIVA" && !x.decisaoId && x.solicitanteId !== usuario.id && podeGerirExcecao,
          })),
        })),
        proximoCursor: reposicoes.length > d.limite ? pagina.at(-1)?.id ?? null : null,
        proximoOrigemCursor: origens.length > d.limite ? paginaOrigens.at(-1)?.aulaOriginalId ?? null : null,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}

/** Q13: fila mínima do professor, limitada à designação ativa ou ao encontro próprio de reposição. */
export async function consultarFilaReposicoesDocente(input: z.input<typeof filtroFila> = {}) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.PROFESSOR);
    const d = filtroFila.parse(input);
    return prisma.$transaction(async (tx) => {
      const [fresco] = await tx.$queryRaw<{ ativo: boolean; papeis: string[] }[]>(Prisma.sql`
        SELECT ativo, papeis FROM "Usuario" WHERE id = ${usuario.id} FOR SHARE
      `);
      if (!fresco?.ativo || (!fresco.papeis.includes(Papel.PROFESSOR) && !fresco.papeis.includes(Papel.ADMINISTRADOR))) throw new ErroPermissao();
      const filas = await tx.$queryRaw<LinhaDocente[]>(Prisma.sql`
        SELECT r.id, r."matriculaId" AS "matriculaId", r.modalidade::text AS modalidade, r."aulaOriginalId" AS "aulaOriginalId", original.inicio, original.fim,
          original."fusoOrigem" AS fuso, participacao_aula_efetiva(registro.id)::text AS participacao,
          COALESCE((SELECT MAX(c.versao) FROM "ConclusaoReposicaoIndividual" c WHERE c."reposicaoId" = r.id), 0)::int AS "versaoAnterior",
          entrega.id AS "entregaId", entrega."entregueEm" AS "entregueEm", entrega.resumo, entrega.atividade, entrega.evidencia AS "evidenciaEntrega"
          ,particular.id AS "encontroReposicaoId",particular.inicio AS "encontroReposicaoInicio",particular.fim AS "encontroReposicaoFim",particular."fusoOrigem" AS "encontroReposicaoFuso",particular.status::text AS "encontroReposicaoStatus",registroParticular.participacao::text AS "participacaoReposicao"
        FROM "ReposicaoIndividual" r
        JOIN "DecisaoReposicaoIndividual" decisao ON decisao."reposicaoId" = r.id AND decisao.aprovada = true
        JOIN "Matricula" matricula ON matricula.id = r."matriculaId"
        JOIN "EncontroAgenda" original ON original.id = r."aulaOriginalId"
        JOIN "AulaDiario" diario ON diario."encontroId" = original.id
        JOIN "RegistroAulaAluno" registro ON registro."aulaId" = diario.id AND registro."matriculaId" = r."matriculaId"
        LEFT JOIN LATERAL (
          SELECT e.id, e."entregueEm", e.resumo, e.atividade, e.evidencia
          FROM "EntregaReposicaoGravacao" e
          WHERE e."reposicaoId" = r.id
            AND NOT EXISTS (SELECT 1 FROM "ConclusaoReposicaoIndividual" c WHERE c."entregaId" = e.id)
            AND NOT EXISTS (SELECT 1 FROM "CorrecaoConclusaoReposicaoIndividual" correcao WHERE correcao."entregaId" = e.id)
          ORDER BY e.versao DESC LIMIT 1
        ) entrega ON true
        LEFT JOIN LATERAL (
          SELECT e.id,e.inicio,e.fim,e."fusoOrigem",e.status FROM "AgendaReposicaoIndividual" agenda
          JOIN "EncontroAgenda" e ON e.id=agenda."encontroId"
          WHERE agenda."reposicaoId"=r.id AND e."professorId"=${usuario.id} AND e.status IN ('PREVISTO'::"StatusEncontroAgenda",'MINISTRADO'::"StatusEncontroAgenda")
          LIMIT 1
        ) particular ON true
        LEFT JOIN "AulaDiario" diarioParticular ON diarioParticular."encontroId"=particular.id
        LEFT JOIN "RegistroAulaAluno" registroParticular ON registroParticular."aulaId"=diarioParticular.id AND registroParticular."matriculaId"=r."matriculaId"
        WHERE COALESCE((
          SELECT CASE WHEN correcao.id IS NOT NULL THEN correcao.concluida ELSE c.concluida END
          FROM "ConclusaoReposicaoIndividual" c
          LEFT JOIN LATERAL (
            SELECT correcao.id, correcao.concluida FROM "CorrecaoConclusaoReposicaoIndividual" correcao
            JOIN "DecisaoCorrecaoConclusaoReposicao" decisaoCorrecao ON decisaoCorrecao."correcaoId" = correcao.id AND decisaoCorrecao.aprovada = true
            WHERE correcao."conclusaoId" = c.id ORDER BY correcao.versao DESC, correcao.id DESC LIMIT 1
          ) correcao ON true
          WHERE c."reposicaoId" = r.id ORDER BY c.versao DESC, c.id DESC LIMIT 1
        ), false) = false
          AND (matricula.status = 'ATIVA' OR (matricula.status IN ('PAUSADA', 'ENCERRADA') AND entrega.id IS NOT NULL))
          AND ((r.modalidade = 'GRAVACAO'::"ModalidadeReposicaoIndividual" AND avaliador_reposicao_vigente(r.id, ${usuario.id}, CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) OR (r.modalidade = 'PARTICULAR'::"ModalidadeReposicaoIndividual" AND particular.id IS NOT NULL))
          AND (${d.cursor ?? null}::text IS NULL OR (original.inicio, r.id) > (
            SELECT cursorOriginal.inicio, cursor.id FROM "ReposicaoIndividual" cursor
            JOIN "EncontroAgenda" cursorOriginal ON cursorOriginal.id = cursor."aulaOriginalId"
            WHERE cursor.id = ${d.cursor ?? ""}
          ))
        ORDER BY original.inicio ASC, r.id ASC
        LIMIT ${d.limite + 1}
      `);
      const pagina = filas.slice(0, d.limite);
      for (const fila of pagina) await tx.$queryRaw(Prisma.sql`SELECT id FROM "ReposicaoIndividual" WHERE id = ${fila.id} FOR SHARE`);
      return {
        itens: pagina.map((r) => ({
          id: r.id, modalidade: r.modalidade,
          origem: { aulaOriginalId: r.aulaOriginalId, matriculaId: r.matriculaId, participacao: r.participacao, inicio: r.inicio.toISOString(), fim: r.fim.toISOString(), fuso: r.fuso, turma: null },
          versaoAnterior: r.versaoAnterior,
          entrega: r.entregaId ? { id: r.entregaId, entregueEm: r.entregueEm!.toISOString(), resumo: r.resumo ?? "", atividade: r.atividade ?? "", evidencia: r.evidenciaEntrega ?? "" } : null,
          encontros: r.encontroReposicaoId ? [{ id: r.encontroReposicaoId, inicio: r.encontroReposicaoInicio!.toISOString(), fim: r.encontroReposicaoFim!.toISOString(), fuso: r.encontroReposicaoFuso!, status: r.encontroReposicaoStatus!, participacao: r.participacaoReposicao }] : [],
        })),
        proximoCursor: filas.length > d.limite ? pagina.at(-1)?.id ?? null : null,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
