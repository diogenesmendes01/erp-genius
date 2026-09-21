import type { Prisma } from "@prisma/client";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { conferirGestorAvaliacao } from "./regras-tx";
import { carregarEstadoFechamentoTx, hashFechamento } from "./fechamento-estado-tx";
import { exigirFechamentoProgressaoTx } from "./progressao-fechamento-tx";

export type AcaoResolucao = "REGISTRAR_CANCELAMENTO" | "RECONFIRMAR_EXECUTADA" | "ENCAMINHAR_REGULARIZACAO";
export type DecisaoResolucaoRevisaoProgressaoEntrada = {
  propostaId: string;
  estadoHash: string;
  aprovada: boolean;
  motivo: string;
};
export const acoesTerminais = ["REGISTRAR_CANCELAMENTO", "RECONFIRMAR_EXECUTADA"] as const;

export async function bloquearResolucaoProgressaoTx(tx: Prisma.TransactionClient, usuarioId: string, solicitacaoId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`resolucao-progressao:${solicitacaoId}`}, 0))`;
  await conferirGestorAvaliacao(tx, usuarioId);
  await tx.$queryRaw`SELECT id FROM "SolicitacaoMudancaAcademica" WHERE id = ${solicitacaoId} FOR UPDATE`;
  const pedido = await tx.solicitacaoMudancaAcademica.findUnique({ where: { id: solicitacaoId } });
  if (!pedido) throw new ErroRegra("Solicitação acadêmica não encontrada.");
  return pedido;
}

export async function carregarResolucaoProgressaoTx(tx: Prisma.TransactionClient, usuarioId: string, solicitacaoId: string, acao: AcaoResolucao) {
  const pedido = await bloquearResolucaoProgressaoTx(tx, usuarioId, solicitacaoId);
  const todos = await tx.casoRevisaoProgressao.findMany({ where: { solicitacaoId }, orderBy: { id: "asc" } });
  const resolvidos = await tx.itemPropostaResolucaoRevisaoProgressao.findMany({ where: {
    casoId: { in: todos.map(c => c.id) }, proposta: { acao: { in: [...acoesTerminais] }, decisao: { aprovada: true } },
  }, select: { casoId: true } });
  const idsResolvidos = new Set(resolvidos.map(i => i.casoId));
  const abertos = todos.filter(c => !idsResolvidos.has(c.id));
  if (!abertos.length) throw new ErroRegra("Não há casos pendentes para esta solicitação.");
  const matriculaId = abertos[0]!.matriculaId;
  if (abertos.some(c => c.matriculaId !== matriculaId) || (pedido.matriculaId && pedido.matriculaId !== matriculaId)) {
    throw new ErroRegra("Confira a matrícula dos casos antes de resolver a revisão.");
  }
  if (acao === "REGISTRAR_CANCELAMENTO" ? pedido.status !== "CANCELADA" : pedido.status !== "EXECUTADA") {
    throw new ErroRegra(acao === "REGISTRAR_CANCELAMENTO"
      ? "Cancele a solicitação pelo fluxo acadêmico antes de registrar esta resolução."
      : "Esta resolução exige uma mudança acadêmica já executada.");
  }
  let base: { estadoHash: string | null; pendencia: string | null; fechamentoId: string | null } | null = null;
  let fechamento: { id: string; estadoHash: string } | null = null;
  if (acao !== "REGISTRAR_CANCELAMENTO") {
    if (pedido.matriculaId !== matriculaId) throw new ErroRegra("Identifique a matrícula da solicitação antes da conferência acadêmica.");
    try {
      const estado = await carregarEstadoFechamentoTx(tx, usuarioId, pedido.alocacaoOrigemId);
      const ultimo = await tx.fechamentoAcademico.findFirst({ where: { matriculaId, nivelId: estado.contexto.nivelId },
        orderBy: { versao: "desc" }, select: { id: true, estadoHash: true, confirmadoEm: true } });
      base = { estadoHash: estado.estadoHash, fechamentoId: ultimo?.id ?? null,
        pendencia: estado.elegibilidade.podeProgredir ? null : "Há requisitos acadêmicos pendentes de regularização." };
      if (acao === "RECONFIRMAR_EXECUTADA") {
        fechamento = await exigirFechamentoProgressaoTx(tx, { matriculaId, alocacaoId: pedido.alocacaoOrigemId, gestorResponsavelId: usuarioId });
        if (!ultimo || ultimo.id === pedido.fechamentoAcademicoId
          || abertos.some(c => ultimo.confirmadoEm.getTime() < c.criadaEm.getTime())) {
          throw new ErroRegra("Confirme um novo fechamento após as correções antes de reconfirmar a progressão.");
        }
      }
    } catch (erro) {
      if (!(erro instanceof ErroRegra) || acao === "RECONFIRMAR_EXECUTADA") throw erro;
      base = { estadoHash: null, fechamentoId: null, pendencia: erro.message };
    }
  }
  const casos = abertos.map(c => {
    const fonte: Record<string, unknown> = { ...c };
    // Colunas novas ausentes nas fontes anteriores não mudam o hash de casos
    // já conferidos antes das migrações. As origens preenchidas integram o hash.
    if (fonte.decisaoCorrecaoConclusaoReposicaoId == null) delete fonte.decisaoCorrecaoConclusaoReposicaoId;
    if (fonte.aprovacaoCorrecaoAulaId == null) delete fonte.aprovacaoCorrecaoAulaId;
    return { id: c.id, casoHash: hashFechamento(JSON.parse(JSON.stringify(fonte))) };
  });
  const ultima = await tx.propostaResolucaoRevisaoProgressao.findFirst({ where: { matriculaId, solicitacaoId }, orderBy: { versao: "desc" }, select: { versao: true } });
  const snapshot = { matriculaId, solicitacaoId, acao, casos, base, fechamento,
    pedido: { status: pedido.status, alocacaoOrigemId: pedido.alocacaoOrigemId, turmaDestinoId: pedido.turmaDestinoId,
      fechamentoAcademicoId: pedido.fechamentoAcademicoId, fechamentoEstadoHash: pedido.fechamentoEstadoHash,
      decididoEm: pedido.decididoEm?.toISOString() ?? null, executadoEm: pedido.executadoEm?.toISOString() ?? null },
  };
  return { matriculaId, solicitacaoId, acao, casos, snapshot, estadoHash: hashFechamento(snapshot), versaoAtual: ultima?.versao ?? 0, fechamento };
}

/**
 * Pré-condição: o chamador já autenticou o ator. Este helper ainda revalida o
 * papel atual sob os mesmos locks usados pelas demais operações de resolução.
 */
export async function decidirResolucaoRevisaoProgressaoTx(
  tx: Prisma.TransactionClient,
  usuarioId: string,
  d: DecisaoResolucaoRevisaoProgressaoEntrada,
) {
  const ref = await tx.propostaResolucaoRevisaoProgressao.findUnique({ where: { id: d.propostaId }, select: { solicitacaoId: true } });
  if (!ref) throw new ErroRegra("Proposta de resolução não encontrada.");
  await bloquearResolucaoProgressaoTx(tx, usuarioId, ref.solicitacaoId);
  const proposta = await tx.propostaResolucaoRevisaoProgressao.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true } });
  if (proposta.preparadorId === usuarioId) throw new ErroRegra("Outra pessoa da Gestão Pedagógica/Administração precisa decidir.");
  if (proposta.estadoHash !== d.estadoHash || hashFechamento(proposta.snapshot) !== proposta.estadoHash) throw new ErroRegra("Confira a versão exata da proposta antes de decidir.");
  if (proposta.decisao) {
    if (proposta.decisao.decisorId !== usuarioId || proposta.decisao.aprovada !== d.aprovada || proposta.decisao.motivo !== d.motivo) throw new ErroRegra("Esta proposta já possui decisão.");
    return { id: proposta.decisao.id, aprovada: proposta.decisao.aprovada };
  }
  let fechamento: { id: string; estadoHash: string } | null = null;
  // Rejeitar registra a recusa da versão atual exata e não resolve casos nem
  // valida a base atual. Só a aprovação pode aplicar o desfecho.
  if (d.aprovada) {
    const estado = await carregarResolucaoProgressaoTx(tx, usuarioId, proposta.solicitacaoId, proposta.acao);
    if (estado.estadoHash !== proposta.estadoHash || estado.versaoAtual !== proposta.versao) throw new ErroRegra("Os casos ou a base acadêmica mudaram. Prepare uma nova revisão.");
    fechamento = estado.fechamento;
  }
  const decisao = await tx.decisaoResolucaoRevisaoProgressao.create({ data: { propostaId: proposta.id, decisorId: usuarioId,
    aprovada: d.aprovada, motivo: d.motivo, fechamentoReconfirmadoId: fechamento?.id ?? null, fechamentoEstadoHash: fechamento?.estadoHash ?? null,
  } });
  await registrarEvento(tx, { tipo: d.aprovada ? "ResolucaoRevisaoProgressaoAprovada" : "ResolucaoRevisaoProgressaoRejeitada",
    agregadoTipo: "Matricula", agregadoId: proposta.matriculaId, autorId: usuarioId,
    payload: { propostaId: proposta.id, decisaoId: decisao.id, acao: proposta.acao,
      terminal: d.aprovada && proposta.acao !== "ENCAMINHAR_REGULARIZACAO", fechamentoId: fechamento?.id ?? null } });
  return { id: decisao.id, aprovada: decisao.aprovada };
}
