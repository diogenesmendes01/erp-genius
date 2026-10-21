import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { carregarContextoEncerramentoTx } from "./encerramento-contexto-tx";
import { calcularPreviaMensalConferida } from "./encerramento-previa-calculo";
import type { PreviaMensalPedidoEncerramentoInput } from "./encerramento-previa-schema";
import { carregarHorasEncerramentoTx } from "./encerramento-horas-tx";
import { consolidarPreviaEncerramento } from "./encerramento-consolidacao";
import { prepararLancamentosEncerramento } from "./encerramento-lancamentos";
import { carregarImpactosAcademicosEncerramentoTx } from "./encerramento-impactos-academicos";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";
import { conferirAgendaEncerramentoTx } from "./encerramento-agenda";

export async function carregarPreviaMensalEncerramentoTx(tx: Prisma.TransactionClient, d: PreviaMensalPedidoEncerramentoInput) {
  const pedido = await tx.solicitacaoEncerramentoMatriculas.findFirst({ where: { id: d.solicitacaoId, alunoId: d.alunoId }, include: { itens: true } });
  if (!pedido || !["ABERTA", "EM_ACERTO"].includes(pedido.status)) throw new ErroRegra("Pedido não está disponível para preparação do acerto.");
  const fusoInstitucional = await carregarFusoInstitucionalTx(tx);
  if (!fusoInstitucional) throw new ErroRegra("Configure o fuso institucional antes de conferir o acerto.");
  const ids = new Set(d.contratos.map((c) => c.matriculaId));
  if (ids.size !== d.contratos.length || ids.size !== pedido.itens.length || pedido.itens.some((i) => !ids.has(i.matriculaId))) throw new ErroRegra("A conferência deve abranger exatamente os contratos do pedido.");
  const contratos = [];
  for (const conferencia of [...d.contratos].sort((a, b) => a.matriculaId.localeCompare(b.matriculaId))) {
    const contexto = await carregarContextoEncerramentoTx(tx, { alunoId: d.alunoId, matriculaId: conferencia.matriculaId });
    const mensal = calcularPreviaMensalConferida(contexto, pedido.dataSolicitada.toISOString().slice(0, 10), conferencia);
    const horas = await carregarHorasEncerramentoTx(tx, d.alunoId, conferencia.matriculaId);
    const impactosAcademicos = await carregarImpactosAcademicosEncerramentoTx(tx, d.alunoId, conferencia.matriculaId);
    const agendaEncerramento = await conferirAgendaEncerramentoTx(tx, impactosAcademicos, mensal.calculo.dataEfetiva, fusoInstitucional, mensal.origem.condicoes!.regras.diaEncerramento === "INCLUIR");
    contratos.push({ ...mensal, impactosAcademicos, agendaEncerramento, ...(horas.origens.length ? { horasAntecipadas: horas } : {}), consolidacao: consolidarPreviaEncerramento(mensal, horas), lancamentos: prepararLancamentosEncerramento(mensal, horas) });
  }
  return { solicitacaoId: pedido.id, fusoInstitucional, dataSolicitada: pedido.dataSolicitada.toISOString().slice(0, 10),
    pedido: { alunoId: pedido.alunoId, dataPedido: pedido.dataPedido.toISOString().slice(0, 10),
      motivo: pedido.motivo, evidenciaPedido: pedido.evidenciaPedido, fusoRegistro: pedido.fusoRegistro,
      motivoRetroatividade: pedido.motivoRetroatividade, evidenciaRetroatividade: pedido.evidenciaRetroatividade },
    exigeAprovacaoRetroatividade: pedido.dataSolicitada < pedido.dataPedido, contratos,
    aviso: "Prévia das mensalidades e multa. Outros componentes do acerto ainda exigem conferência; nenhum crédito, cobrança ou encerramento foi efetivado." };
}
