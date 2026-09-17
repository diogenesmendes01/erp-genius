"use server";

import { Prisma, Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { hashPrevia } from "@/server/contratos/previa-estado";
import { saldoCreditoTx } from "./uso-credito-estado";
import { bloquearMatriculas } from "./recebimentos";

const texto = z.string().trim().min(5).max(2000);
const valor = z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/);
const Propor = z.object({ creditoId: z.string().min(1), valor, pedidoAluno: texto, evidenciaPedido: texto, destino: texto, motivo: texto, chaveIdempotencia: z.string().min(8).max(100) }).strict();
const Decidir = z.object({ propostaId: z.string().min(1), aprovar: z.boolean(), motivo: texto }).strict();
const Executar = z.object({ reservaId: z.string().min(1), resultado: z.enum(["CONFIRMADA", "INCERTO"]), referenciaExterna: z.string().trim().min(1).max(200), evidenciaExecucao: texto, chaveIdempotencia: z.string().min(8).max(100) }).strict();
const Conciliar = z.object({ reservaId: z.string().min(1), confirmouSaida: z.boolean(), evidenciaConciliacao: texto }).strict();
const Cancelar = z.object({ reservaId: z.string().min(1), motivo: texto, evidenciaCancelamento: texto }).strict();

function podeAprovar(u: { ativo: boolean; papeis: Papel[]; permissoes: string[] }) { return u.ativo && (u.papeis.includes(Papel.ADMINISTRADOR) || (u.papeis.includes(Papel.FINANCEIRO) && u.permissoes.includes("financeiro.aprovar_acertos"))); }
function podeExecutar(u: { ativo: boolean; papeis: Papel[]; permissoes: string[] }) { return u.ativo && (u.papeis.includes(Papel.ADMINISTRADOR) || (u.papeis.includes(Papel.FINANCEIRO) && u.permissoes.includes("financeiro.executar_devolucoes"))); }
async function usuarioTx(tx: Prisma.TransactionClient, id: string) { await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${id} FOR SHARE`; const u = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true, permissoes: true } }); if (!u?.ativo || !u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao(); return u; }

export async function proporDevolucaoCredito(input: z.input<typeof Propor>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR), original = Propor.parse(input), v = new Prisma.Decimal(original.valor);
    if (v.lte(0)) throw new ErroRegra("Informe valor positivo.");
    const d = { ...original, valor: v.toFixed(2) };
    return prisma.$transaction(async tx => {
      const credito = await tx.creditoMatricula.findUnique({ where: { id: d.creditoId }, select: { matriculaId: true, moeda: true } }); if (!credito) throw new ErroRegra("Crédito não encontrado.");
      await bloquearMatriculas(tx, [credito.matriculaId]); await usuarioTx(tx, autor.id); await tx.$queryRaw`SELECT id FROM "CreditoMatricula" WHERE id=${d.creditoId} FOR UPDATE`;
      const anterior = await tx.propostaDevolucaoCredito.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } }, include: { decisao: true } });
      if (anterior) { if (anterior.entradaHash !== hashPrevia(d)) throw new ErroRegra("Chave utilizada para outra proposta."); return { id: anterior.id, versao: anterior.versao, reservada: !!anterior.decisao?.aprovada }; }
      const saldo = await saldoCreditoTx(tx, d.creditoId); if (v.gt(saldo)) throw new ErroRegra("Valor excede o saldo disponível do crédito.");
      const ultima = await tx.propostaDevolucaoCredito.findFirst({ where: { creditoId: d.creditoId }, orderBy: { versao: "desc" }, select: { versao: true } });
      const proposta = await tx.propostaDevolucaoCredito.create({ data: { creditoId: d.creditoId, preparadorId: autor.id, versao: (ultima?.versao ?? 0) + 1, valor: v, pedidoAluno: d.pedidoAluno, evidenciaPedido: d.evidenciaPedido, destino: d.destino, snapshot: { creditoId: d.creditoId, matriculaId: credito.matriculaId, moeda: credito.moeda, saldoDisponivel: saldo.toFixed(2), valor: d.valor, destino: d.destino }, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hashPrevia(d) } });
      await registrarEvento(tx, { tipo: "DevolucaoCreditoProposta", agregadoTipo: "Matricula", agregadoId: credito.matriculaId, autorId: autor.id, payload: { propostaId: proposta.id, creditoId: d.creditoId, versao: proposta.versao, valor: d.valor, moeda: credito.moeda } });
      return { id: proposta.id, versao: proposta.versao, reservada: false as const };
    });
  });
}

export async function decidirDevolucaoCredito(input: z.input<typeof Decidir>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR), d = Decidir.parse(input);
    return prisma.$transaction(async tx => {
      const p = await tx.propostaDevolucaoCredito.findUnique({ where: { id: d.propostaId }, include: { credito: { select: { matriculaId: true } }, decisao: { include: { reserva: true } } } }); if (!p) throw new ErroRegra("Proposta não encontrada.");
      await bloquearMatriculas(tx, [p.credito.matriculaId]); const u = await usuarioTx(tx, autor.id); if (!podeAprovar(u)) throw new ErroPermissao("Exige permissão de aprovação financeira."); if (p.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir a devolução.");
      if (p.decisao) { if (p.decisao.decisorId !== autor.id || p.decisao.aprovada !== d.aprovar || p.decisao.motivo !== d.motivo) throw new ErroRegra("A proposta já possui decisão."); return { id: p.decisao.id, aprovada: p.decisao.aprovada, reservaId: p.decisao.reserva?.id ?? null }; }
      if (d.aprovar) { await tx.$queryRaw`SELECT id FROM "CreditoMatricula" WHERE id=${p.creditoId} FOR UPDATE`; if (await tx.propostaDevolucaoCredito.count({ where: { creditoId: p.creditoId, versao: { gt: p.versao } } })) throw new ErroRegra("Confira a versão mais recente da proposta."); const saldo = await saldoCreditoTx(tx, p.creditoId); const s = z.object({ saldoDisponivel: z.string(), valor: z.string(), destino: z.string() }).parse(p.snapshot); if (!new Prisma.Decimal(s.saldoDisponivel).equals(saldo) || !new Prisma.Decimal(s.valor).equals(p.valor) || s.destino !== p.destino) throw new ErroRegra("Saldo, valor ou destino mudaram. Prepare nova devolução."); }
      const decisao = await tx.decisaoDevolucaoCredito.create({ data: { propostaId: p.id, decisorId: autor.id, aprovada: d.aprovar, motivo: d.motivo }, include: { reserva: true } });
      await registrarEvento(tx, { tipo: "DevolucaoCreditoDecidida", agregadoTipo: "Matricula", agregadoId: p.credito.matriculaId, autorId: autor.id, payload: { propostaId: p.id, decisaoId: decisao.id, creditoId: p.creditoId, valor: p.valor.toFixed(2), destino: p.destino, aprovada: d.aprovar } });
      return { id: decisao.id, aprovada: decisao.aprovada, reservaId: decisao.reserva?.id ?? null };
    });
  });
}

export async function registrarExecucaoDevolucaoCredito(input: z.input<typeof Executar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR), d = Executar.parse(input);
    return prisma.$transaction(async tx => {
      let reserva = await tx.reservaDevolucaoCredito.findUnique({ where: { id: d.reservaId }, include: { decisao: { include: { proposta: { include: { credito: { select: { matriculaId: true } } } } } } } }); if (!reserva) throw new ErroRegra("Reserva não encontrada.");
      await bloquearMatriculas(tx, [reserva.decisao.proposta.credito.matriculaId]); await tx.$queryRaw`SELECT id FROM "CreditoMatricula" WHERE id=${reserva.creditoId} FOR UPDATE`;
      reserva = await tx.reservaDevolucaoCredito.findUniqueOrThrow({ where: { id: d.reservaId }, include: { decisao: { include: { proposta: { include: { credito: { select: { matriculaId: true } } } } } } } }); const u = await usuarioTx(tx, autor.id); if (!podeExecutar(u)) throw new ErroPermissao("Exige capacidade específica para executar devolução.");
      if (!["AGUARDANDO_EXECUCAO", "INCERTO"].includes(reserva.estado)) throw new ErroRegra("A devolução já possui resultado final.");
      if (reserva.chaveExecucao && (reserva.executorId !== autor.id || reserva.chaveExecucao !== d.chaveIdempotencia)) throw new ErroRegra("Execução já registrada; concilie o resultado antes de repetir.");
      const atualizado = await tx.reservaDevolucaoCredito.update({ where: { id: reserva.id }, data: { estado: d.resultado, executorId: autor.id, referenciaExterna: d.referenciaExterna, evidenciaExecucao: d.evidenciaExecucao, chaveExecucao: d.chaveIdempotencia, executadaEm: new Date() } });
      await registrarEvento(tx, { tipo: "DevolucaoCreditoExecutada", agregadoTipo: "Matricula", agregadoId: reserva.decisao.proposta.credito.matriculaId, autorId: autor.id, payload: { reservaId: atualizado.id, resultado: atualizado.estado, referenciaExterna: d.referenciaExterna } });
      return { id: atualizado.id, estado: atualizado.estado };
    });
  });
}

export async function conciliarDevolucaoCredito(input: z.input<typeof Conciliar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR), d = Conciliar.parse(input);
    return prisma.$transaction(async tx => {
      let reserva = await tx.reservaDevolucaoCredito.findUnique({ where: { id: d.reservaId }, include: { decisao: { include: { proposta: { include: { credito: { select: { matriculaId: true } } } } } } } }); if (!reserva) throw new ErroRegra("Reserva não encontrada.");
      await bloquearMatriculas(tx, [reserva.decisao.proposta.credito.matriculaId]); await tx.$queryRaw`SELECT id FROM "CreditoMatricula" WHERE id=${reserva.creditoId} FOR UPDATE`;
      reserva = await tx.reservaDevolucaoCredito.findUniqueOrThrow({ where: { id: d.reservaId }, include: { decisao: { include: { proposta: { include: { credito: { select: { matriculaId: true } } } } } } } }); const u = await usuarioTx(tx, autor.id);
      if (!podeExecutar(u) || reserva.estado !== "INCERTO") throw new ErroRegra("A conciliação exige execução incerta e capacidade vigente.");
      await tx.conciliacaoDevolucaoCredito.create({ data: { reservaId: reserva.id, conciliadorId: autor.id, confirmouSaida: d.confirmouSaida, evidencia: d.evidenciaConciliacao } });
      const atualizado = await tx.reservaDevolucaoCredito.findUniqueOrThrow({ where: { id: reserva.id } });
      await registrarEvento(tx, { tipo: "DevolucaoCreditoConciliada", agregadoTipo: "Matricula", agregadoId: reserva.decisao.proposta.credito.matriculaId, autorId: autor.id, payload: { reservaId: atualizado.id, estado: atualizado.estado } }); return { id: atualizado.id, estado: atualizado.estado };
    });
  });
}

export async function cancelarDevolucaoCredito(input: z.input<typeof Cancelar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR), d = Cancelar.parse(input);
    return prisma.$transaction(async tx => {
      let reserva = await tx.reservaDevolucaoCredito.findUnique({ where: { id: d.reservaId }, include: { decisao: { include: { proposta: { include: { credito: { select: { matriculaId: true } } } } } } } }); if (!reserva) throw new ErroRegra("Reserva não encontrada.");
      await bloquearMatriculas(tx, [reserva.decisao.proposta.credito.matriculaId]); await tx.$queryRaw`SELECT id FROM "CreditoMatricula" WHERE id=${reserva.creditoId} FOR UPDATE`;
      reserva = await tx.reservaDevolucaoCredito.findUniqueOrThrow({ where: { id: d.reservaId }, include: { decisao: { include: { proposta: { include: { credito: { select: { matriculaId: true } } } } } } } }); const u = await usuarioTx(tx, autor.id);
      if (!podeAprovar(u) || reserva.estado !== "AGUARDANDO_EXECUCAO") throw new ErroRegra("O cancelamento exige reserva aguardando e capacidade de aprovação.");
      await tx.cancelamentoDevolucaoCredito.create({ data: { reservaId: reserva.id, canceladorId: autor.id, motivo: d.motivo, evidencia: d.evidenciaCancelamento } });
      const atualizado = await tx.reservaDevolucaoCredito.findUniqueOrThrow({ where: { id: reserva.id } });
      await registrarEvento(tx, { tipo: "DevolucaoCreditoCancelada", agregadoTipo: "Matricula", agregadoId: reserva.decisao.proposta.credito.matriculaId, autorId: autor.id, payload: { reservaId: atualizado.id, estado: atualizado.estado } });
      return { id: atualizado.id, estado: atualizado.estado };
    });
  });
}
