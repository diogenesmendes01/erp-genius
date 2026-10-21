import type { Prisma } from "@prisma/client";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import type { carregarAcertoAprovadoParaEfetivacaoTx } from "./encerramento-efetivacao-estado";
import { registrarLimitesEncerramentoTx } from "./encerramento-registro-temporal";

/** Etapa interna: integrar à conferência da agenda e ao financeiro na transação final. */
export async function aplicarEstadoEncerramentoTx(tx: Prisma.TransactionClient, acerto: Awaited<ReturnType<typeof carregarAcertoAprovadoParaEfetivacaoTx>>, agora: Date) {
  const registros = await registrarLimitesEncerramentoTx(tx, acerto, agora);
  for (const registro of registros) {
    const origem = acerto.previa.contratos.find(c => c.calculo.matriculaId === registro.matriculaId)!.impactosAcademicos;
    const alterada = await tx.matricula.updateMany({ where: { id: registro.matriculaId, status: origem.status, acessoVersao: origem.acessoVersao },
      data: { status: "ENCERRADA", acessoVersao: { increment: 1 } } });
    if (alterada.count !== 1) throw new ErroRegra("Matrícula alterada durante o encerramento.");
    const alocacoes: string[] = [];
    for (const v of origem.vinculos.filter(v => v.ativa)) {
      if (v.encerradaEm) throw new ErroRegra("Concilie o vínculo ativo que já possui data de encerramento.");
      const criadaEm = new Date(v.criadoEm);
      // Vínculo cadastrado depois do corte conserva a criação e fica com intervalo vazio.
      const fim = new Date(Math.max(criadaEm.getTime(), registro.limiteVinculo.getTime()));
      const encerrada = await tx.alocacaoTurma.updateMany({ where: { id: v.id, matriculaId: registro.matriculaId, turmaId: v.turmaId, ativa: true, encerradaEm: null, criadoEm: criadaEm }, data: { ativa: false, encerradaEm: fim } });
      if (encerrada.count !== 1) throw new ErroRegra("Vínculo alterado durante o encerramento.");
      alocacoes.push(v.id);
    }
    await tx.movimentacaoAluno.create({ data: { alunoId: acerto.previa.pedido.alunoId, matriculaId: registro.matriculaId, tipo: "ENCERRAMENTO",
      motivo: acerto.previa.pedido.motivo, usuarioId: acerto.executorId, criadoEm: agora,
      observacao: `Acerto ${acerto.decisaoId}. Data efetiva: ${acerto.previa.dataSolicitada}. Registro: ${registro.id}.`,
    } });
    await registrarEvento(tx, { tipo: "MatriculaEncerrada", agregadoTipo: "Matricula", agregadoId: registro.matriculaId, autorId: acerto.executorId,
      payload: { decisaoId: acerto.decisaoId, registroId: registro.id, dataEfetiva: acerto.previa.dataSolicitada, limiteVinculo: registro.limiteVinculo.toISOString(), statusAnterior: registro.statusAnterior, alocacoesEncerradas: alocacoes } });
  }
  return registros;
}
