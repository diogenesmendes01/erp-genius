import { isDeepStrictEqual } from "node:util";
import { Papel, Prisma } from "@prisma/client";
import { ErroPermissao, ErroRegra } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { carregarPreviaMensalEncerramentoTx } from "./encerramento-previa-tx";
import { PreviaMensalPedidoEncerramentoSchema } from "./encerramento-previa-schema";
import { dataCivilInstitucional } from "@/server/operacao/fuso";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";

/** Guarda interna para aplicação: locks e conferência pertencem à mesma transação dos efeitos futuros. */
export async function carregarAcertoAprovadoParaEfetivacaoTx(tx: Prisma.TransactionClient, d: { alunoId: string; decisaoId: string; executorId: string }, agora: Date) {
  // Agenda precede matrícula para compatibilidade com consumo, cancelamento e liberação de horas.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const inicial = await tx.decisaoAcertoEncerramento.findFirst({ where: { id: d.decisaoId, rascunho: { solicitacao: { alunoId: d.alunoId } } }, select: { rascunho: { select: { solicitacaoId: true } } } });
  if (!inicial) throw new ErroRegra("Decisão não encontrada para este aluno.");
  await tx.$queryRaw`SELECT id FROM "SolicitacaoEncerramentoMatriculas" WHERE id=${inicial.rascunho.solicitacaoId} FOR UPDATE`;
  const decisao = await tx.decisaoAcertoEncerramento.findUniqueOrThrow({ where: { id: d.decisaoId }, include: { rascunho: true } });
  const r = decisao.rascunho;
  for (const id of [...new Set([d.executorId, decisao.decisorId])].sort()) {
    await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${id} FOR SHARE`;
    const u = await tx.usuario.findUnique({ where: { id } });
    if (!u?.ativo || !u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao("Responsável financeiro indisponível ou sem permissão vigente.");
    if (id === decisao.decisorId && !u.papeis.includes(Papel.ADMINISTRADOR) && !u.permissoes.includes("financeiro.aprovar_acertos")) throw new ErroPermissao("Permissão de aprovação revogada; exige nova conferência autorizada.");
  }
  if (!decisao.aprovada || decisao.decisorId === r.preparadorId) throw new ErroRegra("Acerto não possui aprovação independente válida.");
  if (await tx.rascunhoAcertoEncerramento.count({ where: { solicitacaoId: r.solicitacaoId, versao: { gt: r.versao } } })) throw new ErroRegra("Existe versão posterior ao acerto aprovado.");
  const entrada = PreviaMensalPedidoEncerramentoSchema.parse(r.entrada);
  const ids = entrada.contratos.map(c => c.matriculaId).sort();
  await bloquearMatriculas(tx, ids);
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
  await tx.$queryRaw`SELECT d.id FROM "Documento" d JOIN "Matricula" m ON m."contratoDocumentoId"=d.id WHERE m.id IN (${Prisma.join(ids)}) ORDER BY d.id FOR SHARE OF d`;
  const fuso = await carregarFusoInstitucionalTx(tx);
  if (!fuso) throw new ErroRegra("Configure o fuso institucional antes de efetivar.");
  const atual = await carregarPreviaMensalEncerramentoTx(tx, entrada);
  if (!isDeepStrictEqual(r.snapshot, atual)) throw new ErroRegra("Origens alteradas depois da aprovação. Prepare novo acerto.");
  if (atual.dataSolicitada > dataCivilInstitucional(agora, fuso)) throw new ErroRegra("A data efetiva do encerramento ainda não chegou.");
  if (atual.exigeAprovacaoRetroatividade && !decisao.autorizaRetroatividade) throw new ErroRegra("Retroatividade não autorizada.");
  if (atual.contratos.some(c => c.propostaExcecaoMulta) && !decisao.autorizaExcecaoMulta) throw new ErroRegra("Exceção de multa não autorizada.");
  if (atual.contratos.some(c => c.consolidacao.pendencias.length || !c.lancamentos.plano)) throw new ErroRegra("Há pendências nos lançamentos do acerto.");
  if (atual.contratos.some(c => c.agendaEncerramento.pendencias.length)) throw new ErroRegra("Regularize a agenda após o limite contratual antes de efetivar.");
  if (await tx.alocacaoTurma.count({ where: { alunoId: d.alunoId, matriculaId: null, ativa: true } })) throw new ErroRegra("Concilie os vínculos legados sem matrícula antes de efetivar.");
  return { executorId: d.executorId, decisaoId: decisao.id, solicitacaoId: r.solicitacaoId, rascunhoId: r.id, fusoInstitucional: fuso, matriculaIds: ids, previa: atual };
}
