import { Papel, type Prisma } from "@prisma/client";
import { ErroPermissao, ErroRegra } from "@/server/_shared";

export type FonteCorrecaoReposicao = {
  concluida: boolean; encontroReposicaoId?: string | null; realizadaEm?: Date | null;
  entregaId?: string | null; validadaEm?: Date | null;
};

export async function conferirAutorCorrecaoReposicaoTx(tx: Prisma.TransactionClient, reposicaoId: string, autorId: string, somenteGestao = false) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  const autor = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true } });
  if (!autor?.ativo) throw new ErroPermissao("O acesso do responsável foi revogado.");
  if (autor.papeis.some(p => p === Papel.ADMINISTRADOR || p === Papel.GERENTE_PEDAGOGICO)) return;
  if (somenteGestao || !autor.papeis.includes(Papel.PROFESSOR)) throw new ErroPermissao();
  const agora = new Date();
  if (!await tx.designacaoAvaliadorReposicaoIndividual.findFirst({ where: { reposicaoId, professorId: autorId, inicio: { lte: agora },
    OR: [{ fim: null }, { fim: { gt: agora } }],
  }, select: { id: true } })) throw new ErroPermissao("Somente o professor com designação vigente pode propor esta correção.");
}

/** Chamador mantém o lock do calendário/reposição. A mesma prova é usada na
 * proposta e na aprovação; retirar conclusão não fabrica uma fonte nova. */
export async function conferirFonteCorrecaoReposicaoTx(tx: Prisma.TransactionClient, reposicaoId: string, fonte: FonteCorrecaoReposicao, avaliadorEsperado?: string | null) {
  const r = await tx.reposicaoIndividual.findUnique({ where: { id: reposicaoId }, select: {
    id: true, modalidade: true, matriculaId: true, matricula: { select: { alunoId: true } }, aulaOriginal: { select: { fim: true } },
  } });
  if (!r) throw new ErroRegra("Reposição não encontrada.");
  if (!fonte.concluida) {
    if (fonte.encontroReposicaoId || fonte.realizadaEm || fonte.entregaId || fonte.validadaEm || avaliadorEsperado) throw new ErroRegra("A retirada da conclusão não recebe outra fonte de realização ou validação.");
    return { validadaPorId: null };
  }
  if (!await tx.decisaoReposicaoIndividual.findUnique({ where: { reposicaoId }, select: { aprovada: true } }).then(d => d?.aprovada)) throw new ErroRegra("A reposição precisa de autorização aprovada.");
  const agora = new Date();
  if (r.modalidade === "PARTICULAR") {
    if (!fonte.encontroReposicaoId || !fonte.realizadaEm || fonte.entregaId || fonte.validadaEm || avaliadorEsperado) throw new ErroRegra("Correção particular exige apenas o encontro próprio e sua realização.");
    const e = await tx.encontroAgenda.findUnique({ where: { id: fonte.encontroReposicaoId }, select: { finalidade: true, turmaId: true, matriculaId: true, status: true, fim: true,
      diario: { select: { registros: { where: { alunoId: r.matricula.alunoId, matriculaId: r.matriculaId, participacao: "PRESENTE" }, select: { id: true } } } },
    } });
    const agenda = await tx.agendaReposicaoIndividual.findFirst({ where: { reposicaoId, encontroId: fonte.encontroReposicaoId }, select: { id: true } });
    if (!agenda || !e || e.finalidade !== "REPOSICAO" || e.turmaId || e.matriculaId !== r.matriculaId || e.status !== "MINISTRADO"
      || e.fim > agora || e.fim < r.aulaOriginal.fim || e.fim.getTime() !== fonte.realizadaEm.getTime() || !e.diario?.registros.length) throw new ErroRegra("A correção exige encontro próprio ministrado e presença comprovada.");
    return { validadaPorId: null };
  }
  if (!fonte.entregaId || !fonte.validadaEm || fonte.encontroReposicaoId || fonte.realizadaEm) throw new ErroRegra("Correção gravada exige entrega do aluno e validação.");
  const entrega = await tx.entregaReposicaoGravacao.findUnique({ where: { id: fonte.entregaId }, select: { reposicaoId: true, alunoId: true, entregueEm: true, resumo: true, atividade: true } });
  if (!entrega || entrega.reposicaoId !== r.id || entrega.alunoId !== r.matricula.alunoId || !entrega.resumo.trim() || !entrega.atividade.trim()
    || entrega.entregueEm > fonte.validadaEm || fonte.validadaEm > agora || fonte.validadaEm < r.aulaOriginal.fim) throw new ErroRegra("A entrega deve pertencer ao aluno e à reposição, com resumo e atividade anteriores à validação.");
  const designacoes = await tx.designacaoAvaliadorReposicaoIndividual.findMany({ where: { reposicaoId, inicio: { lte: fonte.validadaEm },
    OR: [{ fim: null }, { fim: { gt: fonte.validadaEm } }],
  }, select: { professorId: true, professor: { select: { ativo: true, papeis: true } } }, orderBy: [{ inicio: "desc" }, { id: "desc" }], take: 2 });
  if (designacoes.length !== 1 || !designacoes[0]!.professor.ativo || !designacoes[0]!.professor.papeis.includes(Papel.PROFESSOR)
    || (avaliadorEsperado !== undefined && designacoes[0]!.professorId !== avaliadorEsperado)) throw new ErroRegra("Confira o avaliador designado ativo no instante da validação.");
  return { validadaPorId: designacoes[0]!.professorId };
}
