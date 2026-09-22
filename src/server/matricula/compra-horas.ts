"use server";
import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { conferirCompraPreparadaTx } from "./compra-horas-preparacao";

const ResumoLiquidacao = z.object({ liquidacao: z.object({ valorEmDinheiro: z.string(), valorEmCredito: z.string(), valorTotal: z.string() }) });
function resumoLiquidacao(snapshot: Prisma.JsonValue) {
  const l = ResumoLiquidacao.safeParse(snapshot);
  return l.success ? l.data.liquidacao : null;
}

const Entrada = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1), cobrancaId: z.string().min(1), versaoCobranca: z.number().int().nonnegative(),
  minutosComprados: z.number().int().positive().max(5256000), evidenciaCondicoes: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();

export async function consultarComprasHorasAntecipadas(input: { alunoId: string; matriculaId: string }) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.findUnique({ where: { id: usuario.id }, select: { ativo: true, papeis: true, permissoes: true } });
      if (!u?.ativo || !u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const podeAprovar = u.papeis.includes(Papel.ADMINISTRADOR) || u.permissoes.includes("financeiro.aprovar_acertos");
      if (!await tx.matricula.count({ where: { id: d.matriculaId, alunoId: d.alunoId } })) throw new ErroRegra("Matrícula não encontrada para este aluno.");
      const compras = await tx.compraHorasAntecipadas.findMany({ where: { matriculaId: d.matriculaId }, orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
        select: { liquidacaoAcerto: { select: { minutos: true } }, snapshot: true, id: true, cobrancaId: true, minutosComprados: true, valorOriginal: true, descontoOriginal: true, valorPagoAlocado: true, moeda: true, evidenciaCondicoes: true, criadoEm: true, registrador: { select: { nome: true } }, reservas: { select: { id: true, encontroId: true, minutos: true, inicio: true, fim: true, consumo: { select: { id: true, estorno: { select: { id: true, criadoEm: true } }, conferenciaOcorrencia: { select: { id: true, desfecho: true } } } }, encontro: { select: { status: true } }, decisoesLiberacao: { where: { aprovada: true }, select: { id: true, proposta: { select: { destino: true } } } }, propostasLiberacao: { select: { id: true, preparadorId: true, destino: true, valorCredito: true, calculoCredito: true, evidenciaEscolhaRemarcacao: true, motivo: true, decisao: { select: { aprovada: true, motivo: true, credito: { select: { id: true, valorInicial: true, moeda: true } } } } }, orderBy: { criadoEm: "desc" } } }, orderBy: { inicio: "asc" } } } });
      const encontros = await tx.encontroAgenda.findMany({ where: { finalidade: "AULA", matriculaId: d.matriculaId, matricula: { status: "ATIVA" }, status: "PREVISTO", inicio: { gt: new Date() }, reservasHoras: { none: {} } }, orderBy: [{ inicio: "asc" }, { id: "asc" }], take: 100,
        select: { id: true, inicio: true, fim: true, fusoOrigem: true } });
      const cobrancas = await tx.cobranca.findMany({ where: { matriculaId: d.matriculaId, tipo: "HORA_PARTICULAR", status: "PAGO", comprasHoras: { none: {} } }, orderBy: [{ vencimento: "asc" }, { id: "asc" }],
        select: { id: true, versao: true, moeda: true, valorNegociado: true, vencimento: true } });
      return { encontros: encontros.map(e => ({ ...e, inicio: e.inicio.toISOString(), fim: e.fim.toISOString() })), compras: compras.map(({ snapshot, ...c }) => ({ ...c, liquidacao: resumoLiquidacao(snapshot), minutosReservados: c.reservas.filter(r => !r.consumo && !r.decisoesLiberacao.length).reduce((s, r) => s + r.minutos, 0), minutosConvertidosCredito: (c.liquidacaoAcerto?.minutos ?? 0) + c.reservas.filter(r => r.decisoesLiberacao.some(d => d.proposta.destino === "CREDITO")).reduce((s, r) => s + r.minutos, 0), minutosConsumidos: c.reservas.filter(r => !!r.consumo && !r.consumo.estorno).reduce((s, r) => s + r.minutos, 0), minutosEstornados: c.reservas.filter(r => !!r.consumo?.estorno).reduce((s, r) => s + r.minutos, 0), minutosDisponiveis: c.minutosComprados - (c.liquidacaoAcerto?.minutos ?? 0) - c.reservas.filter(r => !r.consumo?.estorno && !r.decisoesLiberacao.some(d => d.proposta.destino === "REMARCACAO")).reduce((s, r) => s + r.minutos, 0), reservas: c.reservas.map(r => ({ id: r.id, encontroId: r.encontroId, minutos: r.minutos, consumo: r.consumo, statusEncontro: r.encontro.status, liberada: r.decisoesLiberacao.some(d => d.proposta.destino === "REMARCACAO"), convertidaCredito: r.decisoesLiberacao.some(d => d.proposta.destino === "CREDITO"), propostasLiberacao: r.propostasLiberacao.map(p => ({ id: p.id, destino: p.destino, valorCredito: p.valorCredito?.toFixed(2) ?? null, calculoCredito: p.calculoCredito, motivo: p.motivo, evidenciaEscolhaRemarcacao: p.evidenciaEscolhaRemarcacao, decisao: p.decisao ? { aprovada: p.decisao.aprovada, motivo: p.decisao.motivo, credito: p.decisao.credito ? { ...p.decisao.credito, valorInicial: p.decisao.credito.valorInicial.toFixed(2) } : null } : null, podeDecidir: podeAprovar && p.preparadorId !== usuario.id && !p.decisao })), inicio: r.inicio.toISOString(), fim: r.fim.toISOString() })), valorOriginal: c.valorOriginal.toFixed(2), descontoOriginal: c.descontoOriginal.toFixed(2), valorPagoAlocado: c.valorPagoAlocado.toFixed(2), criadoEm: c.criadoEm.toISOString() })),
        cobrancas: cobrancas.map((c) => ({ ...c, valorNegociado: c.valorNegociado.toFixed(2), vencimento: c.vencimento.toISOString().slice(0, 10) })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}

/** Identifica uma compra já paga; não registra outro recebimento nem oferece saldo sem lastro. */
export async function registrarCompraHorasAntecipadas(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = Entrada.parse(input), hash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`compra-horas:${autor.id}:${d.chaveIdempotencia}`}, 0))`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => p === "FINANCEIRO" || p === "ADMINISTRADOR")) throw new ErroPermissao();
      const repetida = await tx.compraHorasAntecipadas.findUnique({ where: { registradorId_chaveIdempotencia: { registradorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== hash) throw new ErroRegra("Chave já usada para outra compra de horas.");
        return { id: repetida.id };
      }
      await bloquearMatriculas(tx, [d.matriculaId]);
      const m = await tx.matricula.findFirst({ where: { id: d.matriculaId, alunoId: d.alunoId } });
      if (!m || !["ATIVA", "PAUSADA"].includes(m.status)) throw new ErroRegra("Confira a matrícula ativa ou pausada deste aluno.");
      if (!m.contratoOk || !m.contratoDocumentoId || !m.confirmacaoContratoEm || !m.confirmacaoContratoPorId) throw new ErroRegra("Contrato confirmado é necessário.");
      await tx.$queryRaw`SELECT id FROM "Documento" WHERE id = ${m.contratoDocumentoId} FOR SHARE`;
      const doc = await tx.documento.findFirst({ where: { id: m.contratoDocumentoId, categoria: "CONTRATO", arquivado: false, OR: [{ matriculaId: m.id }, ...(m.leadId ? [{ leadId: m.leadId }] : [])] } });
      if (!doc) throw new ErroRegra("Documento contratual indisponível ou de outra matrícula.");
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id = ${d.cobrancaId} FOR UPDATE`;
      const c = await tx.cobranca.findFirst({ where: { id: d.cobrancaId, matriculaId: m.id }, include: { destinacoesRecebimento: { orderBy: { id: "asc" }, include: { recebimento: { select: { id: true, moeda: true, dataPagamento: true } } } }, informes: { where: { status: "A_CONFERIR" } }, comprasHoras: true } });
      if (!c || c.tipo !== "HORA_PARTICULAR" || c.versao !== d.versaoCobranca || c.moeda !== m.moeda || c.comprasHoras.length) throw new ErroRegra("Cobrança incompatível, desatualizada ou já vinculada a uma compra.");
      const preparacao = await conferirCompraPreparadaTx(tx, m, c, d.minutosComprados);
      // Preço de referência inferior ao negociado não é desconto negativo. Preservar ambos na memória.
      const valorOriginal = preparacao ? Prisma.Decimal.max(c.valorOriginal, c.valorNegociado) : c.valorOriginal;
      const total = c.destinacoesRecebimento.reduce((s, d) => s.plus(d.valor), new Prisma.Decimal(0));
      const utilizacoes = await tx.propostaUsoCredito.findMany({ where: { cobrancaId: c.id, decisao: { aprovada: true } }, orderBy: { id: "asc" },
        select: { id: true, creditoId: true, valor: true, credito: { select: { matriculaId: true, moeda: true } }, decisao: { select: { id: true } } } });
      const credito = utilizacoes.reduce((s, u) => s.plus(u.valor), new Prisma.Decimal(0));
      const liquidado = total.plus(credito);
      if (c.status !== "PAGO" || c.informes.length || c.suspensaPorItemPausaId || c.canceladaPorPausaId || !new Prisma.Decimal(c.valorRecebido ?? 0).equals(total) || !credito.equals(c.valorLiquidadoCredito) || !liquidado.equals(c.valorNegociado) || valorOriginal.lt(c.valorNegociado) || c.valorNegociado.lte(0) || (c.saldo !== null && !c.saldo.isZero()) || c.destinacoesRecebimento.some((d) => d.recebimento.moeda !== c.moeda || d.valor.lte(0)) || utilizacoes.some(u => u.credito.moeda !== c.moeda || u.credito.matriculaId !== m.id || u.valor.lte(0))) throw new ErroRegra("Concilie a quitação integral, as destinações e os créditos aprovados desta compra.");
      const compra = await tx.compraHorasAntecipadas.create({ data: { matriculaId: m.id, cobrancaId: c.id, documentoId: doc.id, registradorId: autor.id,
        minutosComprados: d.minutosComprados, valorOriginal, descontoOriginal: valorOriginal.minus(c.valorNegociado), valorPagoAlocado: liquidado, moeda: c.moeda,
        evidenciaCondicoes: d.evidenciaCondicoes, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash,
        snapshot: { ...(preparacao ? { preparacao, valorReferenciaCobranca: c.valorOriginal.toString() } : {}), cobrancaVersao: c.versao, documento: { id: doc.id, url: doc.url }, recebimentos: c.destinacoesRecebimento.map((d) => ({ id: d.id, recebimentoId: d.recebimento.id, valor: d.valor.toFixed(2), moeda: d.recebimento.moeda, dataPagamento: d.recebimento.dataPagamento.toISOString() })),
          liquidacao: { valorEmDinheiro: total.toFixed(2), valorEmCredito: credito.toFixed(2), valorTotal: liquidado.toFixed(2), utilizacoes: utilizacoes.map(u => ({ propostaId: u.id, decisaoId: u.decisao!.id, creditoId: u.creditoId, valor: u.valor.toFixed(2) })) } } } });
      await registrarEvento(tx, { tipo: "CompraHorasAntecipadasRegistrada", agregadoTipo: "Matricula", agregadoId: m.id, autorId: autor.id, payload: { compraId: compra.id, cobrancaId: c.id, minutosComprados: d.minutosComprados } });
      return { id: compra.id };
    });
  });
}
