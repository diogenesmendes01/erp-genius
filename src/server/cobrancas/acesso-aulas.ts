import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";
import { acessoEfetivoBloqueado, cobrancaGeraRestricaoAutomatica, DIAS_RESTRICAO_AUTOMATICA } from "./acesso-aulas-regras";

/** Trava matrícula antes de cobranças; não chamar mantendo locks de recebimento. */
export async function reavaliarAcessoAutomaticoMatriculaTx(tx: Prisma.TransactionClient, matriculaId: string, agora: Date, opcoes: { naoAguardarCobrancas?: boolean } = {}) {
  await bloquearMatriculas(tx, [matriculaId]);
  if (opcoes.naoAguardarCobrancas) {
    // Consumidores repetíveis cedem a uma baixa concorrente sem formar ciclo de locks.
    await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" = ${matriculaId} ORDER BY id FOR UPDATE NOWAIT`;
  } else {
    await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" = ${matriculaId} ORDER BY id FOR UPDATE`;
  }
  const matricula = await tx.matricula.findUnique({ where: { id: matriculaId }, select: {
    id: true, status: true, acessoBloqueado: true, bloqueadoEm: true, acessoBloqueioManual: true, acessoBloqueioAutomatico: true,
    cobrancas: { select: {
      id: true, status: true, vencimento: true, saldo: true, valorNegociado: true, valorRecebido: true,
    } },
  } });
  if (!matricula) return "inalterado" as const;
  const fuso = await carregarFusoInstitucionalTx(tx);
  const elegiveis = matricula.status === "ATIVA" ? matricula.cobrancas.filter((c) => cobrancaGeraRestricaoAutomatica({
    ...c, saldo: c.saldo === null ? null : Number(c.saldo), valorNegociado: Number(c.valorNegociado), valorRecebido: c.valorRecebido === null ? null : Number(c.valorRecebido),
  }, agora, fuso)) : [];
  const automatico = elegiveis.length > 0;
  const bloqueado = acessoEfetivoBloqueado(matricula.acessoBloqueioManual, automatico);
  if (automatico === matricula.acessoBloqueioAutomatico && bloqueado === matricula.acessoBloqueado) return "inalterado" as const;
  await tx.matricula.update({ where: { id: matricula.id }, data: {
    acessoBloqueioAutomatico: automatico, acessoBloqueado: bloqueado,
    bloqueadoEm: bloqueado ? matricula.bloqueadoEm ?? agora : null,
  } });
  // Sem evento repetido em ticks sucessivos; a transição de motivo também é auditável
  // quando uma restrição manual conserva o estado efetivo.
  const mudouAcesso = bloqueado !== matricula.acessoBloqueado;
  await registrarEvento(tx, {
    tipo: mudouAcesso ? bloqueado ? "AcessoBloqueado" : "AcessoDesbloqueado" : "RestricaoAutomaticaAtualizada",
    agregadoTipo: "Matricula", agregadoId: matricula.id,
    payload: { origem: "AUTOMATICA", diasAtrasoMinimos: DIAS_RESTRICAO_AUTOMATICA, cobrancaIds: elegiveis.map((c) => c.id),
      bloqueioAutomatico: automatico, bloqueioManual: matricula.acessoBloqueioManual, acessoBloqueado: bloqueado,
      motivo: automatico ? "Cobrança com saldo em aberto há pelo menos 30 dias." : "Sem dívida elegível à restrição automática." },
  });
  return mudouAcesso ? bloqueado ? "bloqueado" as const : "liberado" as const : "origem_atualizada" as const;
}

/** Após o commit do recebimento/informe, reflete a nova situação sem inverter locks. */
export async function reavaliarAcessoAutomaticoDaCobranca(cobrancaId: string, agora = new Date()) {
  const vinculo = await prisma.cobranca.findUnique({ where: { id: cobrancaId }, select: { matriculaId: true } });
  if (!vinculo) return "inalterado" as const;
  return prisma.$transaction((tx) => reavaliarAcessoAutomaticoMatriculaTx(tx, vinculo.matriculaId, agora));
}

/** Política institucional de acesso: independe do estado das automações de mensagens. */
export async function rodarControleAcessoAulas(agora = new Date()) {
  const matriculas = await prisma.matricula.findMany({
    where: { OR: [{ status: "ATIVA" }, { acessoBloqueioAutomatico: true }] }, select: { id: true }, orderBy: { id: "asc" },
  });
  const resultado = { avaliadas: 0, bloqueadas: 0, liberadas: 0, origensAtualizadas: 0, inalteradas: 0 };
  for (const matricula of matriculas) {
    const estado = await prisma.$transaction((tx) => reavaliarAcessoAutomaticoMatriculaTx(tx, matricula.id, agora));
    resultado.avaliadas += 1;
    if (estado === "bloqueado") resultado.bloqueadas += 1;
    else if (estado === "liberado") resultado.liberadas += 1;
    else if (estado === "origem_atualizada") resultado.origensAtualizadas += 1;
    else resultado.inalteradas += 1;
  }
  return resultado;
}
