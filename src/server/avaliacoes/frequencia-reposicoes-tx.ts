import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";

/**
 * Fonte de regularização de frequência. As tabelas são deliberadamente
 * consultadas por SQL enquanto a migração de F07.6 não é aplicada: o leitor
 * não pode confundir a particular contratada (`OcorrenciaParticular`) nem a
 * recuperação de nota com uma reposição individual.
 *
 * O contrato completo das tabelas, estados e chaves está em
 * docs/planejamento/reposicao-modelos.prisma. Depois de `prisma generate`,
 * esta consulta pode ser migrada para delegates tipados sem mudar a regra.
 */
type LinhaReposicao = {
  reposicaoId: string;
  aulaOriginalId: string;
  matriculaId: string;
  modalidade: "PARTICULAR" | "GRAVACAO";
  fonteId: string;
  realizadaEm: Date | null;
  validadaEm: Date | null;
};

export type ReposicaoFrequencia = {
  id: string;
  aulaOriginalId: string;
  matriculaId: string;
  modalidade: "PARTICULAR" | "GRAVACAO";
  validadaEm: string;
};

const instanteUtc = (valor: Date) => Prisma.sql`${valor}::timestamptz AT TIME ZONE 'UTC'`;

/**
 * Lê apenas reposições individuais efetivas. Uma correção rejeitada não muda
 * a conclusão anterior; uma aprovada a substitui. A consulta também confere:
 * matrícula/aluno, aula original coletiva ministrada, autorização aprovada,
 * encontro de reposição próprio e presença real na particular, ou entrega,
 * resumo, atividade, designação vigente na validação e validação na gravação.
 * A inativação posterior do avaliador não apaga uma regularização histórica.
 */
export async function carregarReposicoesFrequenciaTx(
  tx: PrismaTypes.TransactionClient,
  entrada: { matriculaId: string; aulaOriginalIds: string[]; apuradaEm: Date },
) {
  if (!entrada.aulaOriginalIds.length) return new Map<string, ReposicaoFrequencia[]>();
  const apuradaEm = instanteUtc(entrada.apuradaEm);

  const linhas = await tx.$queryRaw<LinhaReposicao[]>(Prisma.sql`
    SELECT DISTINCT ON (r.id)
      r.id AS "reposicaoId",
      r."aulaOriginalId" AS "aulaOriginalId",
      r."matriculaId" AS "matriculaId",
      r.modalidade::text AS modalidade,
      COALESCE(corr.id, conclusao.id) AS "fonteId",
      COALESCE(corr."realizadaEm", conclusao."realizadaEm", encontro."fim") AS "realizadaEm",
      COALESCE(corr."validadaEm", conclusao."validadaEm") AS "validadaEm"
    FROM "ReposicaoIndividual" r
    JOIN "DecisaoReposicaoIndividual" autorizacao
      ON autorizacao."reposicaoId" = r.id AND autorizacao.aprovada = true
    JOIN "Matricula" matricula ON matricula.id = r."matriculaId"
    JOIN "EncontroAgenda" original
      ON original.id = r."aulaOriginalId"
      AND original.finalidade = 'AULA'
      AND original."turmaId" IS NOT NULL
      AND original.status = 'MINISTRADO'
    JOIN LATERAL (
      SELECT c.*
      FROM "ConclusaoReposicaoIndividual" c
      WHERE c."reposicaoId" = r.id
      ORDER BY c.versao DESC, c.id DESC
      LIMIT 1
    ) conclusao ON true
    LEFT JOIN LATERAL (
      SELECT correcao.*
      FROM "CorrecaoConclusaoReposicaoIndividual" correcao
      JOIN "DecisaoCorrecaoConclusaoReposicao" decisao
        ON decisao."correcaoId" = correcao.id AND decisao.aprovada = true
      WHERE correcao."conclusaoId" = conclusao.id
      ORDER BY correcao.versao DESC, correcao.id DESC
      LIMIT 1
    ) corr ON true
    LEFT JOIN "EncontroAgenda" encontro
      ON encontro.id = COALESCE(corr."encontroReposicaoId", conclusao."encontroReposicaoId")
    LEFT JOIN "EntregaReposicaoGravacao" entrega
      ON entrega.id = COALESCE(corr."entregaId", conclusao."entregaId")
    LEFT JOIN "Usuario" avaliador
      ON avaliador.id = COALESCE(corr."validadaPorId", conclusao."validadaPorId")
    WHERE r."matriculaId" = ${entrada.matriculaId}
      AND r."aulaOriginalId" IN (${Prisma.join(entrada.aulaOriginalIds)})
      AND COALESCE(corr.concluida, conclusao.concluida) = true
      AND (
        r.modalidade = 'PARTICULAR'
        AND encontro.finalidade = 'REPOSICAO'
        AND encontro."reposicaoIndividualId" = r.id
        AND encontro."turmaId" IS NULL
        AND encontro."matriculaId" = r."matriculaId"
        AND encontro.status = 'MINISTRADO'
        AND encontro."fim" <= ${apuradaEm}
        AND EXISTS (
          SELECT 1 FROM "AgendaReposicaoIndividual" agenda
          WHERE agenda."reposicaoId" = r.id AND agenda."encontroId" = encontro.id
        )
        AND EXISTS (
          SELECT 1
          FROM "AulaDiario" diario
          JOIN "RegistroAulaAluno" registro ON registro."aulaId" = diario.id
          WHERE diario."encontroId" = encontro.id
            AND registro."matriculaId" = r."matriculaId"
            AND registro."alunoId" = matricula."alunoId"
            AND registro.participacao = 'PRESENTE'
        )
      OR r.modalidade = 'GRAVACAO'
        AND entrega."reposicaoId" = r.id
        AND entrega."alunoId" = matricula."alunoId"
        AND COALESCE(corr."validadaEm", conclusao."validadaEm") IS NOT NULL
        AND entrega.resumo <> ''
        AND entrega.atividade <> ''
        AND entrega."entregueEm" <= COALESCE(corr."validadaEm", conclusao."validadaEm")
        AND COALESCE(corr."validadaEm", conclusao."validadaEm") <= ${apuradaEm}
        AND EXISTS (
          SELECT 1
          FROM "DesignacaoAvaliadorReposicaoIndividual" designacao
          WHERE designacao."reposicaoId" = r.id
            AND designacao."professorId" = avaliador.id
            AND designacao.inicio <= COALESCE(corr."validadaEm", conclusao."validadaEm")
            AND (designacao.fim IS NULL OR designacao.fim > COALESCE(corr."validadaEm", conclusao."validadaEm"))
        )
      )
      AND COALESCE(corr."realizadaEm", conclusao."realizadaEm", encontro."fim", corr."validadaEm", conclusao."validadaEm") >= original.fim
    ORDER BY r.id,
      COALESCE(corr.versao, conclusao.versao) DESC,
      COALESCE(corr.id, conclusao.id) DESC
  `);

  const porAula = new Map<string, ReposicaoFrequencia[]>();
  for (const linha of linhas) {
    const validadaEm = linha.modalidade === "PARTICULAR" ? linha.realizadaEm : linha.validadaEm;
    // O WHERE já exige a data. Esta guarda conserva o leitor seguro em caso
    // de esquema incompleto ou de uma fonte manipulada fora do fluxo.
    if (!validadaEm || validadaEm > entrada.apuradaEm) continue;
    const reposicao = {
      id: linha.fonteId,
      aulaOriginalId: linha.aulaOriginalId,
      matriculaId: linha.matriculaId,
      modalidade: linha.modalidade,
      validadaEm: validadaEm.toISOString(),
    };
    const existentes = porAula.get(linha.aulaOriginalId) ?? [];
    existentes.push(reposicao);
    porAula.set(linha.aulaOriginalId, existentes);
  }
  return porAula;
}
