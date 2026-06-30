import { StatusCobranca, StatusComissao, StatusMatricula } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { somarPorMoeda } from "@/lib/dinheiro";

function inicioDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function listarComissoes() {
  const comissoes = await prisma.comissao.findMany({
    orderBy: [{ vendedor: { nome: "asc" } }, { criadoEm: "desc" }],
    include: { vendedor: { select: { nome: true } } },
  });
  return comissoes.map((c) => ({
    id: c.id,
    vendedor: c.vendedor.nome,
    valor: c.valor,
    moeda: c.moeda,
    percentual: c.percentual,
    status: c.status,
    dataPrevistaPagamento: c.dataPrevistaPagamento ? c.dataPrevistaPagamento.toISOString() : null,
  }));
}

export async function kpisFinanceiro() {
  const agora = new Date();
  const ini = inicioDoMes();

  const [pagasMes, abertas, comissoesAprovadas, novasMatriculas] = await Promise.all([
    prisma.cobranca.findMany({
      where: { status: StatusCobranca.PAGO, pagoEm: { gte: ini } },
      select: { valorRecebido: true, valorNegociado: true, moeda: true },
    }),
    prisma.cobranca.findMany({
      where: { status: { in: [StatusCobranca.PENDENTE, StatusCobranca.ATRASADO] } },
      select: { valorNegociado: true, vencimento: true, moeda: true },
    }),
    prisma.comissao.findMany({
      where: { status: StatusComissao.APROVADA },
      select: { valor: true, moeda: true },
    }),
    prisma.matricula.count({ where: { status: StatusMatricula.ATIVA, ativadaEm: { gte: ini } } }),
  ]);

  // Cada KPI é uma lista {moeda, valor} — agrupada por moeda, NUNCA somando moedas diferentes
  // num número só (era o bug central: ₡ + US$ num total sem sentido). Consolidação numa moeda
  // única (com câmbio) é a próxima fase; aqui cada moeda aparece em separado.
  const recebidoMes = somarPorMoeda(pagasMes.map((c) => ({ moeda: c.moeda, valor: c.valorRecebido ?? c.valorNegociado })));
  const emAtraso = somarPorMoeda(
    abertas.filter((c) => c.vencimento < agora).map((c) => ({ moeda: c.moeda, valor: c.valorNegociado })),
  );
  const aReceber = somarPorMoeda(
    abertas.filter((c) => c.vencimento >= agora).map((c) => ({ moeda: c.moeda, valor: c.valorNegociado })),
  );
  const comissoesAPagar = somarPorMoeda(comissoesAprovadas.map((c) => ({ moeda: c.moeda, valor: c.valor })));

  return { recebidoMes, emAtraso, aReceber, comissoesAPagar, novasMatriculas };
}

export interface CotacaoVigente {
  moeda: string;
  /** Unidades da moeda por 1 USD; null = sem cotação cadastrada. USD (pivô) é sempre 1. */
  unidadesPorUsd: number | null;
  vigenteEm: string | null;
  pivo: boolean;
}

/**
 * Moedas oferecidas para consolidação + sua cotação vigente (a mais recente por moeda).
 * Conjunto = USD (pivô) + real (matriz BR) + todas as moedas em uso nos países cadastrados.
 * Alimenta tanto o seletor de consolidação quanto a tela de manutenção de câmbio (Fase B).
 */
export async function dadosCambio(): Promise<CotacaoVigente[]> {
  const [paises, taxas] = await Promise.all([
    prisma.pais.findMany({ select: { moedaLocal: true } }),
    prisma.taxaCambio.findMany({ orderBy: { vigenteEm: "desc" } }),
  ]);
  const ultima = new Map<string, { unidadesPorUsd: number; vigenteEm: Date }>();
  for (const t of taxas) {
    const m = t.moeda.toUpperCase();
    if (!ultima.has(m)) ultima.set(m, { unidadesPorUsd: t.unidadesPorUsd, vigenteEm: t.vigenteEm });
  }
  const moedas = [...new Set(["USD", "BRL", ...paises.map((p) => p.moedaLocal.toUpperCase())])];
  moedas.sort((a, b) => (a === "USD" ? -1 : b === "USD" ? 1 : a.localeCompare(b)));
  return moedas.map((moeda) => {
    if (moeda === "USD") return { moeda, unidadesPorUsd: 1, vigenteEm: null, pivo: true };
    const u = ultima.get(moeda);
    return {
      moeda,
      unidadesPorUsd: u?.unidadesPorUsd ?? null,
      vigenteEm: u ? u.vigenteEm.toISOString() : null,
      pivo: false,
    };
  });
}

/**
 * Relatório gerencial (Fase C) — desconto concedido e comissão, sempre AGRUPADOS POR MOEDA
 * (nunca somando moedas distintas). Reaproveita os campos já denormalizados em AjusteFinanceiro
 * (moeda/vendedor) — antes esse dado existia no banco mas não era exposto em lugar nenhum.
 */
export async function relatorioDescontosComissoes() {
  const [descPorMoeda, descPorVendedor, comissoes, vendedores] = await Promise.all([
    prisma.ajusteFinanceiro.groupBy({ by: ["moeda"], _sum: { descontoValor: true }, _count: { _all: true } }),
    prisma.ajusteFinanceiro.groupBy({
      by: ["vendedorId", "moeda"],
      _sum: { descontoValor: true },
      _count: { _all: true },
    }),
    prisma.comissao.groupBy({ by: ["moeda", "status"], _sum: { valor: true }, _count: { _all: true } }),
    prisma.usuario.findMany({ select: { id: true, nome: true } }),
  ]);
  const nome = new Map(vendedores.map((v) => [v.id, v.nome]));
  return {
    descontoPorMoeda: descPorMoeda
      .map((d) => ({ moeda: d.moeda, total: d._sum.descontoValor ?? 0, qtd: d._count._all }))
      .sort((a, b) => b.total - a.total),
    descontoPorVendedor: descPorVendedor
      .filter((d) => d.vendedorId)
      .map((d) => ({ vendedor: nome.get(d.vendedorId!) ?? "—", moeda: d.moeda, total: d._sum.descontoValor ?? 0, qtd: d._count._all }))
      .sort((a, b) => b.total - a.total),
    comissoesPorStatus: comissoes
      .map((c) => ({ moeda: c.moeda, status: c.status, total: c._sum.valor ?? 0, qtd: c._count._all }))
      .sort((a, b) => a.moeda.localeCompare(b.moeda)),
  };
}
