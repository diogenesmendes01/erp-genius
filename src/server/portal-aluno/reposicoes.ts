import { Prisma } from "@prisma/client";
import { ErroPermissao, ErroRegra } from "@/server/_shared";
import { prazoEntregaVigente, type ProrrogacaoPrazoEtapa } from "./entregas-reposicao";
import { exigirSessaoPortalAluno, type SessaoPortalAluno } from "./sessao";

export type ReposicaoPortalAluno = {
  id: string;
  matriculaId: string;
  modalidade: "PARTICULAR" | "GRAVACAO";
  motivo: string;
  statusMatricula: string;
  autorizada: boolean;
  concluida: boolean;
  dataResultado: Date | null;
  entregaValidadaId: string | null;
  versaoEntregaValidada: number | null;
};

export type DetalheEntregaGravacaoPortalAluno = {
  disponivel: boolean;
  /** Prazo da primeira versão, mantido para o histórico da entrega. */
  prazoAte: string | null;
  /** Prazo aplicável à ação que o aluno pode executar agora. */
  prazoEtapaAte: string | null;
  etapaEntrega: "PRIMEIRA_ENTREGA" | "CORRECAO";
  pausadaDesde: string | null;
  liberacaoEspecifica: boolean;
  /** Fonte efetiva da conclusão, nunca inferida das demais versões entregues. */
  entregaValidada: { entregaId: string; versao: number; validadaEm: string } | null;
  entregas: Array<{ id: string; versao: number; resumo: string; atividade: string; entregueEm: string }>;
  correcoes: Array<{ id: string; entregaId: string; comentario: string; situacao: string; prazoAte: string; respondidaEm: string | null }>;
  /** Relatos feitos pela própria conta, sem expor relatos de outros alunos. */
  relatosIndisponibilidade: Array<{ id: string; descricao: string; situacao: string; criadoEm: string; confirmadoEm: string | null }>;
  /** Interrupções confirmadas do material desta reposição, que explicam o prazo. */
  pausasMaterial: Array<{ id: string; inicio: string; fim: string | null }>;
};

type PausaMaterial = { inicio: Date; fim: Date | null };
type CorrecaoComPrazo = { prazoAte: Date; criadaEm: Date; prorrogacoes: ProrrogacaoPrazoEtapa[] };

/**
 * A resposta a uma correção é uma etapa autônoma. Pausas anteriores à sua
 * criação não podem ampliar (nem encerrar) o prazo publicado para ela.
 */
export function prazoEtapaEntregaPortalAluno(
  prazoPrimeiraEntrega: Date | null,
  pausas: PausaMaterial[],
  prorrogacoesPrimeiraEntrega: ProrrogacaoPrazoEtapa[],
  correcao: CorrecaoComPrazo | null,
): { etapaEntrega: "PRIMEIRA_ENTREGA" | "CORRECAO"; prazoAte: Date | null } {
  if (!correcao) {
    return {
      etapaEntrega: "PRIMEIRA_ENTREGA",
      prazoAte: prazoEntregaVigente(prazoPrimeiraEntrega, pausas, prorrogacoesPrimeiraEntrega),
    };
  }
  const pausasDaCorrecao = pausas
    .filter((pausa): pausa is { inicio: Date; fim: Date } => !!pausa.fim && pausa.fim > correcao.criadaEm)
    .map((pausa) => ({
      inicio: new Date(Math.max(pausa.inicio.getTime(), correcao.criadaEm.getTime())),
      fim: pausa.fim,
    }));
  return {
    etapaEntrega: "CORRECAO",
    prazoAte: prazoEntregaVigente(correcao.prazoAte, pausasDaCorrecao, correcao.prorrogacoes),
  };
}

export async function listarReposicoesDoPortalAluno() {
  const sessao = await exigirSessaoPortalAluno();
  const { prisma } = await import("@/lib/prisma");
  return prisma.$queryRaw<Array<{
    id: string; modalidade: "PARTICULAR" | "GRAVACAO"; statusMatricula: string; autorizada: boolean; concluida: boolean; dataResultado: Date | null;
    entregaValidadaId: string | null; versaoEntregaValidada: number | null;
  }>>(Prisma.sql`
    SELECT r.id, r.modalidade::text AS modalidade, m.status::text AS "statusMatricula",
      EXISTS(SELECT 1 FROM "DecisaoReposicaoIndividual" d WHERE d."reposicaoId" = r.id AND d.aprovada = true) AS autorizada,
      COALESCE(correcao.concluida, conclusao.concluida, false) AS concluida,
      CASE WHEN COALESCE(correcao.concluida, conclusao.concluida, false) THEN
        CASE WHEN correcao.id IS NOT NULL THEN COALESCE(correcao."validadaEm", correcao."realizadaEm")
          ELSE COALESCE(conclusao."validadaEm", conclusao."realizadaEm") END
      ELSE NULL END AS "dataResultado",
      CASE WHEN COALESCE(correcao.concluida, conclusao.concluida, false) THEN entrega.id ELSE NULL END AS "entregaValidadaId",
      CASE WHEN COALESCE(correcao.concluida, conclusao.concluida, false) THEN entrega.versao ELSE NULL END AS "versaoEntregaValidada"
    FROM "ReposicaoIndividual" r
    JOIN "Matricula" m ON m.id = r."matriculaId" AND m."alunoId" = ${sessao.alunoId}
    LEFT JOIN LATERAL (
      SELECT c.id, c.concluida, c."entregaId", c."validadaEm", c."realizadaEm" FROM "ConclusaoReposicaoIndividual" c
      WHERE c."reposicaoId" = r.id ORDER BY c.versao DESC, c.id DESC LIMIT 1
    ) conclusao ON true
    LEFT JOIN LATERAL (
      SELECT cor.id, cor.concluida, cor."entregaId", cor."validadaEm", cor."realizadaEm" FROM "CorrecaoConclusaoReposicaoIndividual" cor
      JOIN "DecisaoCorrecaoConclusaoReposicao" dec ON dec."correcaoId" = cor.id AND dec.aprovada = true
      WHERE cor."conclusaoId" = conclusao.id ORDER BY cor.versao DESC, cor.id DESC LIMIT 1
    ) correcao ON true
    LEFT JOIN "EntregaReposicaoGravacao" entrega ON entrega.id = CASE
      WHEN correcao.id IS NOT NULL AND correcao.concluida THEN correcao."entregaId"
      WHEN correcao.id IS NULL AND conclusao.concluida THEN conclusao."entregaId"
      ELSE NULL
    END AND entrega."reposicaoId" = r.id AND entrega."alunoId" = m."alunoId"
    ORDER BY r."criadaEm" DESC, r.id DESC
  `);
}

/**
 * Escopo row-level do portal. Não recebe alunoId do navegador e não infere o
 * aluno de `Usuario`: toda leitura começa na sessão opaca do portal e cruza a
 * matrícula que é dona da reposição.
 */
export async function exigirReposicaoDoPortalAluno(reposicaoId: string, sessao?: SessaoPortalAluno): Promise<ReposicaoPortalAluno> {
  if (!reposicaoId) throw new ErroRegra("Reposição não informada.");
  const identidade = sessao ?? await exigirSessaoPortalAluno();
  const { prisma } = await import("@/lib/prisma");
  const [reposicao] = await prisma.$queryRaw<ReposicaoPortalAluno[]>(Prisma.sql`
    SELECT r.id, r."matriculaId" AS "matriculaId", r.modalidade::text AS modalidade, r.motivo,
      m.status::text AS "statusMatricula", EXISTS(
        SELECT 1 FROM "DecisaoReposicaoIndividual" d WHERE d."reposicaoId" = r.id AND d.aprovada = true
      ) AS autorizada,
      COALESCE(correcao.concluida, conclusao.concluida, false) AS concluida,
      CASE WHEN COALESCE(correcao.concluida, conclusao.concluida, false) THEN
        CASE WHEN correcao.id IS NOT NULL THEN COALESCE(correcao."validadaEm", correcao."realizadaEm")
          ELSE COALESCE(conclusao."validadaEm", conclusao."realizadaEm") END
      ELSE NULL END AS "dataResultado",
      CASE WHEN COALESCE(correcao.concluida, conclusao.concluida, false) THEN entrega.id ELSE NULL END AS "entregaValidadaId",
      CASE WHEN COALESCE(correcao.concluida, conclusao.concluida, false) THEN entrega.versao ELSE NULL END AS "versaoEntregaValidada"
    FROM "ReposicaoIndividual" r
    JOIN "Matricula" m ON m.id = r."matriculaId"
    LEFT JOIN LATERAL (
      SELECT c.id, c.concluida, c."entregaId", c."validadaEm", c."realizadaEm" FROM "ConclusaoReposicaoIndividual" c
      WHERE c."reposicaoId" = r.id ORDER BY c.versao DESC, c.id DESC LIMIT 1
    ) conclusao ON true
    LEFT JOIN LATERAL (
      SELECT cor.id, cor.concluida, cor."entregaId", cor."validadaEm", cor."realizadaEm" FROM "CorrecaoConclusaoReposicaoIndividual" cor
      JOIN "DecisaoCorrecaoConclusaoReposicao" dec ON dec."correcaoId" = cor.id AND dec.aprovada = true
      WHERE cor."conclusaoId" = conclusao.id
      ORDER BY cor.versao DESC, cor.id DESC LIMIT 1
    ) correcao ON true
    LEFT JOIN "EntregaReposicaoGravacao" entrega ON entrega.id = CASE
      WHEN correcao.id IS NOT NULL AND correcao.concluida THEN correcao."entregaId"
      WHEN correcao.id IS NULL AND conclusao.concluida THEN conclusao."entregaId"
      ELSE NULL
    END AND entrega."reposicaoId" = r.id AND entrega."alunoId" = m."alunoId"
    WHERE r.id = ${reposicaoId} AND m."alunoId" = ${identidade.alunoId}
  `);
  if (!reposicao) throw new ErroPermissao("Esta reposição não pertence ao aluno autenticado.");
  return reposicao;
}

/** Detalhe estritamente da própria matrícula. Não devolve identificador de
 * Drive ou URL: a futura reprodução autenticada receberá só esta autorização. */
export async function consultarEntregaGravacaoPortalAluno(reposicaoId: string, sessao?: SessaoPortalAluno): Promise<DetalheEntregaGravacaoPortalAluno | null> {
  const identidade = sessao ?? await exigirSessaoPortalAluno();
  const reposicao = await exigirReposicaoDoPortalAluno(reposicaoId, identidade);
  if (reposicao.modalidade !== "GRAVACAO") return null;
  const { prisma } = await import("@/lib/prisma");
  const agora = new Date();
  const [material] = await prisma.$queryRaw<Array<{ disponivel: boolean; prazoAte: Date | null; pausadaDesde: Date | null; liberadaAte: Date | null }>>(Prisma.sql`
    SELECT COALESCE(material.disponivel, false) AS disponivel,
      disponibilidade."prazoInicialAte" AS "prazoAte",
      (SELECT i.inicio FROM "IndisponibilidadeMaterialReposicao" i WHERE i."materialId" = material.id AND i.fim IS NULL ORDER BY i.inicio DESC LIMIT 1) AS "pausadaDesde",
      (SELECT l."expiraEm" FROM "LiberacaoEntregaReposicao" l WHERE l."reposicaoId" = ${reposicao.id} AND l."contaId" = ${identidade.contaId}
          AND l.inicio <= ${agora} AND l."expiraEm" > ${agora} ORDER BY l."expiraEm" DESC LIMIT 1) AS "liberadaAte"
    FROM "ReposicaoIndividual" r
    LEFT JOIN "MaterialReposicaoGravacao" material ON material."reposicaoId" = r.id
    LEFT JOIN "DisponibilizacaoEntregaReposicao" disponibilidade ON disponibilidade."reposicaoId" = r.id
    WHERE r.id = ${reposicao.id}
  `);
  const prorrogacoes = await prisma.$queryRaw<Array<ProrrogacaoPrazoEtapa & { solicitacaoCorrecaoId: string | null }>>(Prisma.sql`
    SELECT "solicitacaoCorrecaoId" AS "solicitacaoCorrecaoId", "novoPrazo" AS "novoPrazo",
      "criadaEm" AS "autorizadaEm", versao
    FROM "ProrrogacaoPrazoReposicao"
    WHERE "reposicaoId" = ${reposicao.id}
    ORDER BY "criadaEm", versao
  `);
  const pausas = await prisma.$queryRaw<Array<{ id: string; inicio: Date; fim: Date | null }>>(Prisma.sql`
    SELECT i.id, i.inicio, i.fim FROM "IndisponibilidadeMaterialReposicao" i
    JOIN "MaterialReposicaoGravacao" material ON material.id = i."materialId"
    WHERE material."reposicaoId" = ${reposicao.id}
  `);
  const prorrogacoesPrimeiraEtapa = prorrogacoes.filter((item) => item.solicitacaoCorrecaoId === null);
  const primeiraEtapa = prazoEtapaEntregaPortalAluno(material?.prazoAte ?? null, pausas, prorrogacoesPrimeiraEtapa, null);
  const [entregas, correcoes, relatos] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; versao: number; resumo: string; atividade: string; entregueEm: Date }>>(Prisma.sql`
      SELECT id, versao, resumo, atividade, "entregueEm" AS "entregueEm" FROM "EntregaReposicaoGravacao"
      WHERE "reposicaoId" = ${reposicao.id} AND "alunoId" = ${identidade.alunoId} ORDER BY versao DESC
    `),
    prisma.$queryRaw<Array<{ id: string; entregaId: string; comentario: string; situacao: string; prazoAte: Date; criadaEm: Date; respondidaEm: Date | null }>>(Prisma.sql`
      SELECT c.id, c."entregaId" AS "entregaId", c.comentario, c.situacao::text AS situacao,
        c."prazoAte", c."criadaEm", c."respondidaEm" AS "respondidaEm"
      FROM "SolicitacaoCorrecaoEntregaReposicao" c
      JOIN "EntregaReposicaoGravacao" e ON e.id = c."entregaId" AND e."alunoId" = ${identidade.alunoId}
      WHERE c."reposicaoId" = ${reposicao.id} ORDER BY c."criadaEm" DESC
    `),
    prisma.$queryRaw<Array<{ id: string; descricao: string; situacao: string; criadoEm: Date; confirmadoEm: Date | null }>>(Prisma.sql`
      SELECT relato.id, relato.descricao, relato.situacao::text AS situacao,
        relato."criadaEm" AS "criadoEm", relato."confirmadoEm" AS "confirmadoEm"
      FROM "RelatoIndisponibilidadeMaterialReposicao" relato
      JOIN "MaterialReposicaoGravacao" material ON material.id = relato."materialId"
      WHERE material."reposicaoId" = ${reposicao.id}
        AND relato."contaPortalAlunoId" = ${identidade.contaId}
      ORDER BY relato."criadaEm" DESC, relato.id DESC
    `),
  ]);
  const correcoesComPrazo = correcoes.map((correcao) => {
    const correcaoComProrrogacoes = {
      ...correcao,
      prorrogacoes: prorrogacoes.filter((item) => item.solicitacaoCorrecaoId === correcao.id),
    };
    return {
      ...correcaoComProrrogacoes,
      prazoAte: prazoEtapaEntregaPortalAluno(null, pausas, [], correcaoComProrrogacoes).prazoAte ?? correcao.prazoAte,
    };
  });
  const correcaoPendente = correcoesComPrazo.find((correcao) => correcao.situacao === "PENDENTE") ?? null;
  const etapaAtual = prazoEtapaEntregaPortalAluno(
    material?.prazoAte ?? null,
    pausas,
    prorrogacoesPrimeiraEtapa,
    correcaoPendente,
  );
  return {
    disponivel: !!material?.disponivel,
    prazoAte: primeiraEtapa.prazoAte?.toISOString() ?? null,
    prazoEtapaAte: etapaAtual.prazoAte?.toISOString() ?? null,
    etapaEntrega: etapaAtual.etapaEntrega,
    pausadaDesde: material?.pausadaDesde?.toISOString() ?? null,
    liberacaoEspecifica: !!material?.liberadaAte,
    entregaValidada: reposicao.concluida && reposicao.entregaValidadaId && reposicao.versaoEntregaValidada !== null && reposicao.dataResultado
      ? { entregaId: reposicao.entregaValidadaId, versao: reposicao.versaoEntregaValidada, validadaEm: reposicao.dataResultado.toISOString() }
      : null,
    entregas: entregas.map((e) => ({ ...e, entregueEm: e.entregueEm.toISOString() })),
    correcoes: correcoesComPrazo.map((c) => ({
      id: c.id,
      entregaId: c.entregaId,
      comentario: c.comentario,
      situacao: c.situacao,
      prazoAte: c.prazoAte.toISOString(),
      respondidaEm: c.respondidaEm?.toISOString() ?? null,
    })),
    relatosIndisponibilidade: relatos.map((relato) => ({
      id: relato.id,
      descricao: relato.descricao,
      situacao: relato.situacao,
      criadoEm: relato.criadoEm.toISOString(),
      confirmadoEm: relato.confirmadoEm?.toISOString() ?? null,
    })),
    pausasMaterial: pausas.map((pausa) => ({
      id: pausa.id,
      inicio: pausa.inicio.toISOString(),
      fim: pausa.fim?.toISOString() ?? null,
    })),
  };
}

/**
 * Q36: pausa/encerramento não apaga leitura. O escritor deve informar a
 * liberação específica e o prazo vigente, pois estas fontes serão adicionadas
 * com a etapa de entrega; sem elas a resposta é pendência, não autorização.
 */
export function estadoEntregaPortalAluno(
  reposicao: ReposicaoPortalAluno,
  contexto: { prazoAberto: boolean; liberacaoEspecifica: boolean },
): "PODE_ENTREGAR" | "PENDENTE_LIBERACAO" | "PRAZO_ENCERRADO" | "INDISPONIVEL" {
  if (!reposicao.autorizada || reposicao.concluida) {
    return "INDISPONIVEL";
  }
  if (!contexto.prazoAberto) return "PRAZO_ENCERRADO";
  if (reposicao.statusMatricula !== "ATIVA" && !contexto.liberacaoEspecifica) {
    return "PENDENTE_LIBERACAO";
  }
  return "PODE_ENTREGAR";
}

export function exigirEntregaPortalAluno(
  reposicao: ReposicaoPortalAluno,
  contexto: { prazoAberto: boolean; liberacaoEspecifica: boolean },
): void {
  if (estadoEntregaPortalAluno(reposicao, contexto) !== "PODE_ENTREGAR") {
    throw new ErroRegra("Esta reposição não está disponível para nova entrega.");
  }
}
