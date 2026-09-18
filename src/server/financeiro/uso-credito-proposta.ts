"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "./recebimentos";
import { estadoUsoCreditoTx, saldoCreditoTx } from "./uso-credito-estado";
import { hashPrevia } from "@/server/contratos/previa-estado";
const texto = z.string().trim().min(5).max(2000);
const Entrada = z.object({ creditoId: z.string().min(1), cobrancaId: z.string().min(1), valor: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/), concordancia: texto, motivo: texto, chaveIdempotencia: z.string().min(8).max(100) }).strict();

async function conferirAutor(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${id} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true, permissoes: true } });
  if (!u?.ativo || !u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
  return u;
}

/** Preparação não reserva crédito, não aprova abatimento e não registra recebimento. */
export async function proporUtilizacaoCredito(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.FINANCEIRO), original = Entrada.parse(input);
    const valor = new Prisma.Decimal(original.valor), d = { ...original, valor: valor.toFixed(2) };
    if (valor.lte(0)) throw new ErroRegra("Informe valor positivo.");
    return prisma.$transaction(async tx => {
      const inicial = await tx.creditoMatricula.findUnique({ where: { id: d.creditoId }, select: { matriculaId: true } });
      if (!inicial) throw new ErroRegra("Crédito não encontrado.");
      await bloquearMatriculas(tx, [inicial.matriculaId]);
      await conferirAutor(tx, u.id);
      const anterior = await tx.propostaUsoCredito.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: u.id, chaveIdempotencia: d.chaveIdempotencia } }, include: { decisao: true } });
      if (anterior) {
        if (anterior.entradaHash !== hashPrevia(d)) throw new ErroRegra("Chave utilizada para outra proposta.");
        return { id: anterior.id, versao: anterior.versao, aplicada: anterior.decisao?.aprovada ?? false };
      }
      await tx.$queryRaw`SELECT id FROM "CreditoMatricula" WHERE id = ${d.creditoId} FOR UPDATE`;
      const { credito, c, snapshot } = await estadoUsoCreditoTx(tx, d.creditoId, d.cobrancaId, valor);
      const ultima = await tx.propostaUsoCredito.findFirst({ where: { creditoId: credito.id }, orderBy: { versao: "desc" }, select: { versao: true } });
      const p = await tx.propostaUsoCredito.create({ data: { creditoId: credito.id, cobrancaId: c.id, preparadorId: u.id, valor, concordancia: d.concordancia, motivo: d.motivo,
        versao: (ultima?.versao ?? 0) + 1, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hashPrevia(d), snapshot } });
      await registrarEvento(tx, { tipo: "UtilizacaoCreditoProposta", agregadoTipo: "Matricula", agregadoId: credito.matriculaId, autorId: u.id, payload: { propostaId: p.id, creditoId: credito.id, cobrancaId: c.id, versao: p.versao, valor: valor.toFixed(2), moeda: c.moeda, aplicada: false } });
      return { id: p.id, versao: p.versao, aplicada: false as const };
    });
  });
}

export async function consultarPropostasUsoCredito(input: { alunoId: string; creditoId: string }) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const d = z.object({ alunoId: z.string().min(1), creditoId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const usuario = await conferirAutor(tx, u.id);
      const credito = await tx.creditoMatricula.findFirst({ where: { id: d.creditoId, matricula: { alunoId: d.alunoId } } });
      if (!credito) throw new ErroRegra("Crédito não encontrado para este aluno.");
      const cobrancas = await tx.cobranca.findMany({ where: { matriculaId: credito.matriculaId, moeda: credito.moeda, status: { in: ["PENDENTE", "ATRASADO"] }, suspensaPorItemPausaId: null, canceladaPorPausaId: null }, orderBy: [{ vencimento: "asc" }, { id: "asc" }], select: { id: true, codigo: true, saldo: true, valorNegociado: true, valorRecebido: true, valorLiquidadoCredito: true, valorCompensadoPermuta: true, vencimento: true } });
      const propostas = await tx.propostaUsoCredito.findMany({ where: { creditoId: credito.id }, orderBy: { versao: "desc" }, select: { id: true, cobrancaId: true, preparadorId: true, valor: true, versao: true, concordancia: true, motivo: true, criadoEm: true, decisao: { select: { aprovada: true, motivo: true } } } });
      const devolucoes = await tx.propostaDevolucaoCredito.findMany({
        where: { creditoId: credito.id }, orderBy: { versao: "desc" },
        select: { id: true, preparadorId: true, valor: true, versao: true, pedidoAluno: true, evidenciaPedido: true, destino: true, criadaEm: true,
          decisao: { select: { id: true, decisorId: true, aprovada: true, motivo: true,
            reserva: { select: { id: true, valor: true, estado: true, executorId: true, referenciaExterna: true, evidenciaExecucao: true, chaveExecucao: true, executadaEm: true,
              conciliacoes: { select: { confirmouSaida: true, evidencia: true, criadaEm: true } },
              cancelamento: { select: { motivo: true, evidencia: true, criadaEm: true } },
            } },
          },
          },
        },
      });
      const reservasDevolucao = devolucoes.reduce((s, p) => p.decisao?.reserva && ["AGUARDANDO_EXECUCAO", "INCERTO"].includes(p.decisao.reserva.estado) ? s.plus(p.decisao.reserva.valor) : s, new Prisma.Decimal(0));
      const devolvido = devolucoes.reduce((s, p) => p.decisao?.reserva?.estado === "CONFIRMADA" ? s.plus(p.decisao.reserva.valor) : s, new Prisma.Decimal(0));
      return { creditoId: credito.id, matriculaId: credito.matriculaId, moeda: credito.moeda, valorCredito: (await saldoCreditoTx(tx, credito.id)).toFixed(2), reservaDevolucao: reservasDevolucao.toFixed(2), devolvido: devolvido.toFixed(2),
        cobrancas: cobrancas.map(c => ({ id: c.id, codigo: c.codigo, saldo: (c.saldo ?? Prisma.Decimal.max(0, c.valorNegociado.minus(c.valorRecebido ?? 0).minus(c.valorLiquidadoCredito).minus(c.valorCompensadoPermuta))).toFixed(2), vencimento: c.vencimento.toISOString() })),
        propostas: propostas.map(p => ({ id: p.id, cobrancaId: p.cobrancaId, versao: p.versao, concordancia: p.concordancia, motivo: p.motivo, decisao: p.decisao, podeDecidir: !p.decisao && p.preparadorId !== u.id && (usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.permissoes.includes("financeiro.aprovar_acertos")), valor: p.valor.toFixed(2), criadoEm: p.criadoEm.toISOString() })),
        devolucoes: devolucoes.map(p => ({ id: p.id, versao: p.versao, valor: p.valor.toFixed(2), pedidoAluno: p.pedidoAluno, evidenciaPedido: p.evidenciaPedido, destino: p.destino, criadoEm: p.criadaEm.toISOString(), decisao: p.decisao && { ...p.decisao, reserva: p.decisao.reserva && { ...p.decisao.reserva, valor: p.decisao.reserva.valor.toFixed(2), executadaEm: p.decisao.reserva.executadaEm?.toISOString() ?? null, conciliacoes: p.decisao.reserva.conciliacoes.map(c => ({ ...c, criadaEm: c.criadaEm.toISOString() })), cancelamento: p.decisao.reserva.cancelamento && { ...p.decisao.reserva.cancelamento, criadaEm: p.decisao.reserva.cancelamento.criadaEm.toISOString() } } }, podeDecidir: !p.decisao && p.preparadorId !== u.id && (usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.permissoes.includes("financeiro.aprovar_acertos")), podeExecutar: p.decisao?.reserva?.estado === "AGUARDANDO_EXECUCAO" && (usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.permissoes.includes("financeiro.executar_devolucoes")), podeConciliar: p.decisao?.reserva?.estado === "INCERTO" && (usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.permissoes.includes("financeiro.executar_devolucoes")), podeCancelar: p.decisao?.reserva?.estado === "AGUARDANDO_EXECUCAO" && (usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.permissoes.includes("financeiro.aprovar_acertos")) })),
        aplicacaoDisponivel: true as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
