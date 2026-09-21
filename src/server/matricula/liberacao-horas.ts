"use server";
import { isDeepStrictEqual } from "node:util";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { hashPrevia } from "@/server/contratos/previa-estado";
import { calcularCreditoHorasTx } from "./credito-horas-calculo";
const texto = z.string().trim().min(5).max(2000);

async function contexto(tx: Prisma.TransactionClient, reservaId: string, autorId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const inicial = await tx.reservaHorasCompradas.findUnique({ where: { id: reservaId }, select: { compra: { select: { matriculaId: true } } } });
  if (!inicial) throw new ErroRegra("Reserva não encontrada.");
  await bloquearMatriculas(tx, [inicial.compra.matriculaId]);
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autorId} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true, permissoes: true } });
  if (!u?.ativo || !u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
  const r = await tx.reservaHorasCompradas.findUniqueOrThrow({ where: { id: reservaId }, include: { consumo: true, decisoesLiberacao: { where: { aprovada: true } }, encontro: { select: { status: true, matriculaId: true } } } });
  return { r, matriculaId: inicial.compra.matriculaId, podeAprovar: u.papeis.includes(Papel.ADMINISTRADOR) || u.permissoes.includes("financeiro.aprovar_acertos") };
}

export async function proporLiberacaoHorasRemarcacao(input: { reservaId: string; evidenciaEscolhaRemarcacao: string; motivo: string; chaveIdempotencia: string; destino?: "REMARCACAO" | "CREDITO" }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ reservaId: z.string().min(1), evidenciaEscolhaRemarcacao: texto, motivo: texto, chaveIdempotencia: z.string().min(8).max(100), destino: z.enum(["REMARCACAO", "CREDITO"]).optional() }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const { r, matriculaId } = await contexto(tx, d.reservaId, u.id);
      const anterior = await tx.propostaLiberacaoHoras.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (anterior) {
        if (anterior.entradaHash !== hashPrevia(d)) throw new ErroRegra("Chave usada para outra proposta.");
        return { id: anterior.id };
      }
      if (r.consumo || r.decisoesLiberacao.length || r.encontro.status !== "CANCELADO" || r.encontro.matriculaId !== matriculaId) throw new ErroRegra("Exige reserva não consumida nem liberada de encontro cancelado da mesma matrícula.");
      const cancelamento = await tx.decisaoCancelamentoParticular.findFirst({ where: { aprovada: true, proposta: { encontroId: r.encontroId, origem: "ESCOLA" } }, orderBy: { decididaEm: "desc" } });
      if (!cancelamento) throw new ErroRegra("É necessário cancelamento da escola aprovado pela gestão.");
      if (await tx.propostaLiberacaoHoras.count({ where: { reservaId: r.id, decisao: null } })) throw new ErroRegra("Existe proposta aguardando decisão.");
      const destino = d.destino ?? "REMARCACAO";
      const calculo = destino === "CREDITO" ? await calcularCreditoHorasTx(tx, r.id) : null;
      const p = await tx.propostaLiberacaoHoras.create({ data: { ...d, destino, ...(calculo ? { valorCredito: calculo.valorCredito, calculoCredito: calculo } : {}), cancelamentoId: cancelamento.id, preparadorId: u.id, entradaHash: hashPrevia(d) } });
      await registrarEvento(tx, { tipo: destino === "CREDITO" ? "CreditoHorasCanceladasProposto" : "LiberacaoHorasRemarcacaoProposta", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: u.id, payload: { propostaId: p.id, reservaId: r.id, cancelamentoId: cancelamento.id, minutos: r.minutos, ...(calculo ? { valorCredito: calculo.valorCredito, moeda: calculo.moeda } : {}) } });
      return { id: p.id };
    });
  });
}

export async function decidirLiberacaoHorasRemarcacao(input: { propostaId: string; aprovar: boolean; motivo: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ propostaId: z.string().min(1), aprovar: z.boolean(), motivo: texto }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const inicial = await tx.propostaLiberacaoHoras.findUnique({ where: { id: d.propostaId } });
      if (!inicial) throw new ErroRegra("Proposta não encontrada.");
      const { r, matriculaId, podeAprovar } = await contexto(tx, inicial.reservaId, u.id);
      if (!podeAprovar) throw new ErroPermissao("Exige permissão de aprovação financeira.");
      const p = await tx.propostaLiberacaoHoras.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true, cancelamento: { include: { proposta: true } } } });
      if (p.preparadorId === u.id) throw new ErroRegra("Outra pessoa deve decidir a liberação.");
      if (p.decisao) {
        if (p.decisao.decisorId !== u.id || p.decisao.aprovada !== d.aprovar || p.decisao.motivo !== d.motivo) throw new ErroRegra("Proposta já decidida.");
        return { id: p.decisao.id, aprovada: p.decisao.aprovada };
      }
      if (d.aprovar && (r.consumo || r.decisoesLiberacao.length || r.encontro.status !== "CANCELADO" || r.encontro.matriculaId !== matriculaId || !p.cancelamento.aprovada || p.cancelamento.proposta.encontroId !== r.encontroId)) throw new ErroRegra("A reserva ou seu cancelamento não permite a liberação. Confira novamente.");
      const calculo = d.aprovar && p.destino === "CREDITO" ? await calcularCreditoHorasTx(tx, r.id) : null;
      if (calculo && (!isDeepStrictEqual(calculo, p.calculoCredito) || !p.valorCredito?.equals(calculo.valorCredito))) throw new ErroRegra("O cálculo mudou. Rejeite e prepare nova proposta de crédito.");
      const decisao = await tx.decisaoLiberacaoHoras.create({ data: { propostaId: p.id, reservaId: r.id, decisorId: u.id, aprovada: d.aprovar, motivo: d.motivo } });
      const credito = calculo ? await tx.creditoMatricula.create({ data: { matriculaId, origemLiberacaoId: decisao.id, valorInicial: calculo.valorCredito, moeda: calculo.moeda } }) : null;
      await registrarEvento(tx, { tipo: p.destino === "CREDITO" ? "CreditoHorasCanceladasDecidido" : "LiberacaoHorasRemarcacaoDecidida", agregadoTipo: "Matricula", agregadoId: matriculaId, autorId: u.id, payload: { propostaId: p.id, decisaoId: decisao.id, reservaId: r.id, aprovada: d.aprovar, minutos: r.minutos, motivo: d.motivo, ...(credito ? { creditoId: credito.id, valorCredito: credito.valorInicial.toFixed(2), moeda: credito.moeda } : {}) } });
      return { id: decisao.id, aprovada: d.aprovar };
    });
  });
}
