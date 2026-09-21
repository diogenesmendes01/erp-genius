import { Papel, Prisma } from "@prisma/client";
import { ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { revalidarFechamentoHorasTx } from "./fechamento-horas-revalidacao-tx";
import { instanteDaGrade } from "@/server/agenda/grade";
import { dataCivilInstitucional } from "@/server/operacao/fuso";

/** Executor interno. Chamador fornece identidade autenticada; efeitos ficam na mesma transação. */
export async function emitirFechamentoHorasTx(tx: Prisma.TransactionClient, d: { alunoId: string; matriculaId: string; decisaoId: string; executorId: string }) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
  await bloquearMatriculas(tx, [d.matriculaId]);
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${d.executorId} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id: d.executorId } });
  if (!u?.ativo || !u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
  const decisao = await tx.decisaoFechamentoHoras.findFirst({ where: { id: d.decisaoId, rascunho: { matriculaId: d.matriculaId, matricula: { alunoId: d.alunoId } } }, include: { emissao: true } });
  if (!decisao?.aprovada || !decisao.confirmaReferenciaContratual) throw new ErroRegra("Decisão aprovada não encontrada para esta matrícula.");
  if (decisao.emissao) return { id: decisao.emissao.id, cobrancaId: decisao.emissao.cobrancaId };
  const atual = await revalidarFechamentoHorasTx(tx, { alunoId: d.alunoId, matriculaId: d.matriculaId, rascunhoId: decisao.rascunhoId });
  const a = atual.apuracao;
  if (!a.itens.length || !["APURACAO_COMPLETA", "PROPOSTA_PARCIAL"].includes(a.estado)) throw new ErroRegra("Esta decisão não autoriza emitir itens neste estado da apuração.");
  const hoje = dataCivilInstitucional(new Date(), atual.periodo.fuso);
  const c = await tx.cobranca.create({ data: { matriculaId: d.matriculaId, tipo: "HORA_PARTICULAR", moeda: a.moeda,
    valorOriginal: a.totalApurado, valorNegociado: a.totalApurado, saldo: a.totalApurado,
    vencimento: instanteDaGrade(atual.periodo.vencimento, "12:00", atual.periodo.fuso),
    status: atual.periodo.vencimento < hoje ? "ATRASADO" : "PENDENTE",
    comentario: `Fechamento por hora: ${atual.periodo.inicio} a ${atual.periodo.fim}` } });
  const emissao = await tx.emissaoFechamentoHoras.create({ data: { decisaoId: decisao.id, cobrancaId: c.id, executorId: u.id, memoria: { periodo: atual.periodo, apuracao: a } } });
  for (const item of a.itens) {
    const conferenciaId = a.origens.find(o => o.encontroId === item.encontroId)?.conferenciaId;
    if (!conferenciaId) throw new ErroRegra("Item sem conferência financeira.");
    await tx.itemFechamentoHoras.create({ data: { emissaoId: emissao.id, conferenciaId, valor: item.valor } });
  }
  await registrarEvento(tx, { tipo: "FechamentoHorasEmitido", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: u.id,
    payload: { emissaoId: emissao.id, decisaoId: decisao.id, cobrancaId: c.id, total: a.totalApurado } });
  await tx.$executeRaw`SET CONSTRAINTS validar_conjunto_emissao_horas IMMEDIATE`;
  return { id: emissao.id, cobrancaId: c.id };
}
