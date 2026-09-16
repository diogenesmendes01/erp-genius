import type { Prisma } from "@prisma/client";

/**
 * Dependências de reposição da aula corrigida. O chamador já mantém o lock do
 * calendário; esta leitura não autoriza nem amplia a consulta para matrículas
 * fora da chamada original.
 *
 * `reposicoes` conserva o resumo usado pela comparação da correção. O
 * inventário é deliberadamente restrito a identificadores, estados e datas:
 * nenhum texto, evidência, arquivo, URL ou token integra o hash de revisão.
 */
export async function carregarReposicoesCorrecaoAulaTx(
  tx: Prisma.TransactionClient,
  aulaOriginalId: string,
  matriculas: string[],
) {
  const reposicoes = await tx.reposicaoIndividual.findMany({
    where: { aulaOriginalId, matriculaId: { in: matriculas } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      matriculaId: true,
      modalidade: true,
      decisao: { select: { id: true, aprovada: true, decididaEm: true } },
      conclusoes: {
        orderBy: { versao: "desc" },
        take: 1,
        select: {
          id: true,
          versao: true,
          concluida: true,
          criadaEm: true,
          realizadaEm: true,
          validadaEm: true,
          correcoes: {
            where: { decisao: { aprovada: true } },
            orderBy: { versao: "desc" },
            take: 1,
            select: { id: true, versao: true, concluida: true, criadaEm: true, realizadaEm: true, validadaEm: true, decisao: { select: { id: true, aprovada: true, decididaEm: true } } },
          },
        },
      },
      agendaParticular: {
        select: {
          id: true,
          beneficioId: true,
          autorizacaoExcecaoId: true,
          excecaoId: true,
          statusBeneficio: true,
          periodoInicio: true,
          periodoFimExclusivo: true,
          consumidaEm: true,
          devolvidaEm: true,
          encontro: { select: { id: true, inicio: true, fim: true, status: true, professorId: true } },
        },
      },
      materialGravacao: { select: { id: true, publicacaoAulaId: true, provedor: true, disponivel: true, publicadoEm: true, criadaEm: true,
        indisponibilidades: { orderBy: { id: "asc" }, select: { id: true, relatoId: true, inicio: true, fim: true } } } },
      correcoesEntrega: { orderBy: { id: "asc" }, select: { id: true, entregaId: true, situacao: true, prazoBaseMinutos: true,
        prazoAte: true, respondidaEm: true } },
      prorrogacoesPrazo: { orderBy: [{ versao: "asc" }, { id: "asc" }], select: { id: true, solicitacaoCorrecaoId: true,
        versao: true, prazoAnterior: true, novoPrazo: true } },
      liberacoesEntrega: { orderBy: { id: "asc" }, select: { id: true, inicio: true, expiraEm: true } },
      disponibilizacaoEntrega: { select: { id: true, disponibilizadaEm: true, prazoBaseMinutos: true, prazoInicialAte: true, criadaEm: true } },
      designacoes: { orderBy: { id: "asc" }, select: { id: true, professorId: true, inicio: true, fim: true, criadaEm: true } },
      entregas: { orderBy: [{ versao: "asc" }, { id: "asc" }], select: { id: true, versao: true, entregueEm: true, criadaEm: true } },
    },
  });

  const dataIso = (data: Date | null) => data?.toISOString() ?? null;
  return {
    reposicoes: reposicoes.map(r => ({
      id: r.id,
      matriculaId: r.matriculaId,
      modalidade: r.modalidade,
      decisao: r.decisao ? { id: r.decisao.id, aprovada: r.decisao.aprovada } : null,
      conclusaoId: r.conclusoes[0]?.id ?? null,
      correcaoId: r.conclusoes[0]?.correcoes[0]?.id ?? null,
      concluida: r.conclusoes[0]?.correcoes[0]?.concluida ?? r.conclusoes[0]?.concluida ?? false,
    })),
    inventarioReposicoes: reposicoes.map(r => ({
      id: r.id,
      matriculaId: r.matriculaId,
      modalidade: r.modalidade,
      decisao: r.decisao ? { id: r.decisao.id, aprovada: r.decisao.aprovada, decididaEm: dataIso(r.decisao.decididaEm) } : null,
      conclusao: r.conclusoes[0] ? {
        id: r.conclusoes[0].id,
        versao: r.conclusoes[0].versao,
        concluida: r.conclusoes[0].concluida,
        criadaEm: dataIso(r.conclusoes[0].criadaEm),
        realizadaEm: dataIso(r.conclusoes[0].realizadaEm),
        validadaEm: dataIso(r.conclusoes[0].validadaEm),
        correcaoAprovada: r.conclusoes[0].correcoes[0] ? {
          id: r.conclusoes[0].correcoes[0].id,
          versao: r.conclusoes[0].correcoes[0].versao,
          concluida: r.conclusoes[0].correcoes[0].concluida,
          criadaEm: dataIso(r.conclusoes[0].correcoes[0].criadaEm),
          realizadaEm: dataIso(r.conclusoes[0].correcoes[0].realizadaEm),
          validadaEm: dataIso(r.conclusoes[0].correcoes[0].validadaEm),
          decisao: r.conclusoes[0].correcoes[0].decisao ? { id: r.conclusoes[0].correcoes[0].decisao.id, aprovada: r.conclusoes[0].correcoes[0].decisao.aprovada, decididaEm: dataIso(r.conclusoes[0].correcoes[0].decisao.decididaEm) } : null,
        } : null,
      } : null,
      agendaParticular: r.agendaParticular ? {
        id: r.agendaParticular.id,
        beneficioId: r.agendaParticular.beneficioId,
        autorizacaoExcecaoId: r.agendaParticular.autorizacaoExcecaoId,
        excecaoId: r.agendaParticular.excecaoId,
        statusBeneficio: r.agendaParticular.statusBeneficio,
        periodoInicio: dataIso(r.agendaParticular.periodoInicio),
        periodoFimExclusivo: dataIso(r.agendaParticular.periodoFimExclusivo),
        consumidaEm: dataIso(r.agendaParticular.consumidaEm),
        devolvidaEm: dataIso(r.agendaParticular.devolvidaEm),
        encontro: {
          id: r.agendaParticular.encontro.id,
          inicio: dataIso(r.agendaParticular.encontro.inicio),
          fim: dataIso(r.agendaParticular.encontro.fim),
          status: r.agendaParticular.encontro.status,
          professorId: r.agendaParticular.encontro.professorId,
        },
      } : null,
      materialGravacao: r.materialGravacao ? {
        id: r.materialGravacao.id,
        publicacaoAulaId: r.materialGravacao.publicacaoAulaId,
        provedor: r.materialGravacao.provedor,
        disponivel: r.materialGravacao.disponivel,
        publicadoEm: dataIso(r.materialGravacao.publicadoEm),
        criadaEm: dataIso(r.materialGravacao.criadaEm),
        indisponibilidades: r.materialGravacao.indisponibilidades.map(i => ({ id: i.id, relatoId: i.relatoId, inicio: dataIso(i.inicio), fim: dataIso(i.fim) })),
      } : null,
      disponibilizacaoEntrega: r.disponibilizacaoEntrega ? {
        id: r.disponibilizacaoEntrega.id,
        disponibilizadaEm: dataIso(r.disponibilizacaoEntrega.disponibilizadaEm),
        prazoBaseMinutos: r.disponibilizacaoEntrega.prazoBaseMinutos,
        prazoInicialAte: dataIso(r.disponibilizacaoEntrega.prazoInicialAte),
        criadaEm: dataIso(r.disponibilizacaoEntrega.criadaEm),
      } : null,
      designacoes: r.designacoes.map(d => ({ id: d.id, professorId: d.professorId, inicio: dataIso(d.inicio), fim: dataIso(d.fim), criadaEm: dataIso(d.criadaEm) })),
      correcoesEntrega: r.correcoesEntrega.map(c => ({ id: c.id, entregaId: c.entregaId, situacao: c.situacao,
        prazoBaseMinutos: c.prazoBaseMinutos, prazoAte: dataIso(c.prazoAte), respondidaEm: dataIso(c.respondidaEm) })),
      prorrogacoesPrazo: r.prorrogacoesPrazo.map(p => ({ id: p.id, solicitacaoCorrecaoId: p.solicitacaoCorrecaoId, versao: p.versao,
        prazoAnterior: dataIso(p.prazoAnterior), novoPrazo: dataIso(p.novoPrazo) })),
      liberacoesEntrega: r.liberacoesEntrega.map(l => ({ id: l.id, inicio: dataIso(l.inicio), expiraEm: dataIso(l.expiraEm) })),
      entregas: r.entregas.map(e => ({ id: e.id, versao: e.versao, entregueEm: dataIso(e.entregueEm), criadaEm: dataIso(e.criadaEm) })),
    })),
  };
}
