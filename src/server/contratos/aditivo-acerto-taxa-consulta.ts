"use server";

import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { carregarEstadoConferenciaFinalAditivoTx } from "./aditivo-conferencia-final-estado";
import { calcularCreditoAcertoTaxa } from "./aditivo-acerto-taxa-calculo";
import { ConsultarAlvosAcertoTaxaAditivoSchema } from "./aditivo-acerto-taxa-schema";

/**
 * Prévia somente de leitura. Cada linha continua exigindo escolha explícita da
 * cobrança existente: esta consulta nunca seleciona uma "primeira futura".
 */
export async function consultarAlvosAcertoTaxaAditivo(input: unknown) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const d = ConsultarAlvosAcertoTaxaAditivoSchema.parse(input);
    return prisma.$transaction(async tx => {
      const estado = await carregarEstadoConferenciaFinalAditivoTx(tx, d);
      if (estado.revisaoHash !== d.revisaoHash) throw new ErroRegra("A conferência final mudou; atualize a prévia do aditivo.");
      const versao = await tx.versaoCondicoesAditivo.findFirst({
        where: { matriculaId: d.matriculaId, propostaId: d.propostaId },
        select: { id: true, condicoes: true, condicoesHash: true, conferenciaFinal: { select: { conclusaoId: true } } },
      });
      if (!versao || versao.conferenciaFinal.conclusaoId !== d.conclusaoId) {
        return { estado: "CONDICOES_NAO_FORMALIZADAS" as const, mensagem: "A taxa só pode ser preparada depois de formalizar as condições do aditivo." };
      }
      const condicoes = versao.condicoes as Record<string, unknown>;
      const taxaValor = condicoes.TAXA_VALOR as { tipo?: string; valor?: string; moeda?: string } | undefined;
      const taxaVencimento = condicoes.TAXA_VENCIMENTO as { tipo?: string; data?: string } | undefined;
      if (!taxaValor && !taxaVencimento) return { estado: "SEM_TAXA" as const, mensagem: "Esta versão formalizada não altera valor ou vencimento da taxa." };
      if (taxaValor && (taxaValor.tipo !== "DINHEIRO" || typeof taxaValor.valor !== "string" || typeof taxaValor.moeda !== "string")) throw new ErroRegra("A condição TAXA_VALOR formalizada está inválida.");
      if (taxaVencimento && (taxaVencimento.tipo !== "DATA" || typeof taxaVencimento.data !== "string")) throw new ErroRegra("A condição TAXA_VENCIMENTO formalizada está inválida.");
      const cobrancas = await tx.cobranca.findMany({
        where: { matriculaId: d.matriculaId, tipo: "MATRICULA" },
        orderBy: [{ vencimento: "asc" }, { id: "asc" }],
        select: { id: true, codigo: true, versao: true, status: true, moeda: true, valorOriginal: true, valorNegociado: true, valorRecebido: true, valorLiquidadoCredito: true, saldo: true, vencimento: true, recebimentos: { select: { id: true } }, informes: { where: { status: "A_CONFERIR" }, select: { id: true } }, utilizacoesCreditoPropostas: { select: { id: true } }, compensacoesCobertura: { select: { id: true } }, ajusteAcerto: { select: { id: true } }, suspensaPorItemPausaId: true, canceladaPorPausaId: true },
      });
      const creditosPorCobranca = cobrancas.length === 0 ? [] : await tx.$queryRaw<Array<{ cobrancaId: string; total: Prisma.Decimal }>>(Prisma.sql`
        SELECT "cobrancaId", coalesce(sum(valor), 0)::numeric AS total
        FROM "OrigemCreditoAcertoTaxaAditivo"
        WHERE "cobrancaId" IN (${Prisma.join(cobrancas.map(c => c.id))})
        GROUP BY "cobrancaId"
      `);
      const creditoAnterior = new Map(creditosPorCobranca.map(c => [c.cobrancaId, c.total]));
      return {
        estado: "PRONTA_PARA_SELECAO" as const,
        versaoCondicoesId: versao.id,
        condicoesHash: versao.condicoesHash,
        cobrancas: cobrancas.map(c => {
          const valorNovo = taxaValor?.valor ? new Prisma.Decimal(taxaValor.valor) : c.valorNegociado;
          const memoria = calcularCreditoAcertoTaxa({ valorRecebido: c.valorRecebido, valorLiquidadoCredito: c.valorLiquidadoCredito, valorNovo, creditosTaxaJaOriginados: creditoAnterior.get(c.id) ?? 0 });
          return {
            id: c.id, codigo: c.codigo, versao: c.versao, status: c.status, moeda: c.moeda,
            valorOriginal: c.valorOriginal.toFixed(2), valorNegociado: c.valorNegociado.toFixed(2), valorRecebido: c.valorRecebido?.toFixed(2) ?? null, valorLiquidadoCredito: c.valorLiquidadoCredito.toFixed(2), saldo: c.saldo?.toFixed(2) ?? null, vencimento: c.vencimento.toISOString().slice(0, 10),
            valorNovo: valorNovo.toFixed(2), vencimentoNovo: taxaVencimento?.data ?? c.vencimento.toISOString().slice(0, 10), creditoAnterior: memoria.creditoAnterior.toFixed(2), creditoNovo: memoria.creditoNovo.toFixed(2), creditoTotalDevido: memoria.creditoTotalDevido.toFixed(2), saldoAposAcerto: memoria.saldoAposAcerto.toFixed(2), pendencia: memoria.pendencia && { codigo: memoria.pendencia.codigo, valor: memoria.pendencia.valor.toFixed(2), tratamento: memoria.pendencia.tratamento },
            movimento: { recebimentos: c.recebimentos.length, informesAtivos: c.informes.length, usosCredito: c.utilizacoesCreditoPropostas.length, compensacoes: c.compensacoesCobertura.length, ajusteAcertoId: c.ajusteAcerto?.id ?? null, suspensaPorPausaId: c.suspensaPorItemPausaId, canceladaPorPausaId: c.canceladaPorPausaId },
          };
        }),
      };
    }, { isolationLevel: "RepeatableRead" });
  });
}

export async function consultarAcertoTaxaPorProposta(input: unknown) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const d = ConsultarAlvosAcertoTaxaAditivoSchema.pick({ matriculaId: true, propostaId: true }).parse(input);
    const c = await prisma.conclusaoAssinaturaAditivo.findFirst({
      where: { processo: { propostaId: d.propostaId, proposta: { matriculaId: d.matriculaId } } },
      orderBy: { concluidaEm: "desc" },
    });
    if (!c) return { estado: "SEM_CONCLUSAO" as const, mensagem: "A assinatura do aditivo ainda não foi concluída." };
    const estado = await prisma.$transaction(tx => carregarEstadoConferenciaFinalAditivoTx(tx, { ...d, conclusaoId: c.id }));
    const resultado = await consultarAlvosAcertoTaxaAditivo({ ...d, conclusaoId: c.id, revisaoHash: estado.revisaoHash });
    if (!resultado.ok) throw new ErroRegra(resultado.erro);
    if (!resultado.dado) throw new ErroRegra("Prévia do acerto indisponível.");
    return { ...resultado.dado, conclusaoId: c.id, revisaoHash: estado.revisaoHash };
  });
}

export async function listarHistoricoAcertosTaxa(input: unknown) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = ConsultarAlvosAcertoTaxaAditivoSchema.pick({ matriculaId: true, propostaId: true }).parse(input);
    const atual = await prisma.usuario.findUnique({ where: { id: usuario.id }, select: { ativo: true, papeis: true, permissoes: true } });
    const aprova = Boolean(atual?.ativo && (atual.papeis.includes(Papel.ADMINISTRADOR) || (atual.papeis.includes(Papel.FINANCEIRO) && atual.permissoes.includes("financeiro.aprovar_acertos"))));
    const propostas = await prisma.propostaAcertoTaxaAditivo.findMany({
      where: { matriculaId: d.matriculaId, propostaAditivoId: d.propostaId },
      orderBy: [{ criadaEm: "desc" }, { id: "desc" }],
      include: { preparador: { select: { nome: true } }, cobranca: { select: { codigo: true, moeda: true } }, decisao: { include: { decisor: { select: { nome: true } } } }, aplicacao: { include: { executor: { select: { nome: true } } } }, invalidacao: { include: { resolvedor: { select: { nome: true } } } } },
    });
    return propostas.map(p => {
      const fotografia = p.fotografia as { cobranca?: { valorNegociado?: string; valorRecebido?: string | null; valorLiquidadoCredito?: string; vencimento?: string }; calculo?: { creditoAnterior?: string }; comissoes?: Array<{ id?: string; tipo?: string; status?: string; percentual?: string; valor?: string; valorBase?: string | null }> };
      return ({
      id: p.id, cobrancaId: p.cobrancaId, status: p.status, codigo: p.cobranca.codigo ?? p.cobrancaId, moeda: p.cobranca.moeda,
      preparador: p.preparador.nome, criadaEm: p.criadaEm.toISOString(), motivo: p.motivo,
      evidencia: typeof p.evidencia === "object" && p.evidencia !== null && !Array.isArray(p.evidencia) && typeof p.evidencia.texto === "string" ? p.evidencia.texto : "Evidência estruturada preservada no registro do acerto.",
      anterior: { valor: fotografia.cobranca?.valorNegociado ?? null, recebido: fotografia.cobranca?.valorRecebido ?? null, creditoLiquidado: fotografia.cobranca?.valorLiquidadoCredito ?? null, vencimento: fotografia.cobranca?.vencimento?.slice(0, 10) ?? null, creditoOriginado: fotografia.calculo?.creditoAnterior ?? null },
      valorNovo: p.valorNovo.toFixed(2), vencimentoNovo: p.vencimentoNovo.toISOString().slice(0, 10), creditoNovo: p.creditoNovo.toFixed(2),
      comissoes: (fotografia.comissoes ?? []).map(c => { const percentual = c.tipo === "PERCENTUAL" && c.status !== "PAGA" && c.status !== "ESTORNADA"; return { id: c.id ?? "", tipo: c.tipo === "VALOR_FIXO" ? "Fixa" : "Percentual", status: c.status ?? "Não informado", valorAntes: c.valor ?? null, valorDepois: percentual && c.percentual ? new Prisma.Decimal(p.valorNovo).mul(c.percentual).div(100).toFixed(2) : c.valor ?? null, baseAntes: c.valorBase ?? null, baseDepois: percentual ? p.valorNovo.toFixed(2) : c.valorBase ?? null, preservada: !percentual }; }),
      decisao: p.decisao && { aprovada: p.decisao.aprovada, motivo: p.decisao.motivo, autor: p.decisao.decisor.nome, data: p.decisao.decididaEm.toISOString() },
      aplicacao: p.aplicacao && { autor: p.aplicacao.executor.nome, data: p.aplicacao.aplicadaEm.toISOString(), valorAnterior: p.aplicacao.valorAnterior.toFixed(2) },
      invalidacao: p.invalidacao && { autor: p.invalidacao.resolvedor.nome, motivo: p.invalidacao.motivo, data: p.invalidacao.criadaEm.toISOString() },
      podeDecidir: aprova && p.preparadorId !== usuario.id && p.status === "PENDENTE" && !p.decisao,
      podeAplicar: aprova && p.status === "APROVADA" && p.decisao?.decisorId === usuario.id && !p.aplicacao,
      podeInvalidar: aprova && p.preparadorId !== usuario.id && p.status === "APROVADA" && !p.aplicacao && !p.invalidacao,
    }); });
  });
}

export async function listarAditivosParaAcertoTaxa(pagina = 1) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.FINANCEIRO);
    if (!Number.isInteger(pagina) || pagina < 1 || pagina > 100000) throw new ErroRegra("Página inválida.");
    const versoes = await prisma.versaoCondicoesAditivo.findMany({
      where: { OR: [{ condicoes: { path: ["TAXA_VALOR"], not: Prisma.AnyNull } }, { condicoes: { path: ["TAXA_VENCIMENTO"], not: Prisma.AnyNull } }] },
      orderBy: [{ registradaEm: "desc" }, { id: "desc" }], skip: (pagina - 1) * 30, take: 31,
      select: { matriculaId: true, propostaId: true, versao: true, registradaEm: true },
    });
    return { itens: versoes.slice(0, 30), temProxima: versoes.length > 30 };
  });
}
