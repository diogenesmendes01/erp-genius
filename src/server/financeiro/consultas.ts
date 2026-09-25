import { Papel, Prisma, StatusCobranca, StatusComissao, StatusMatricula } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { somarPorMoeda } from "@/lib/dinheiro";
import { numero, numeroOuNull, semDecimais } from "@/server/_shared/decimal";
import { exigirSessaoComPapel, ErroPermissao } from "@/server/_shared";
import { saldoAtual } from "./regras";
import { carregarTrilhasVencimentoCivil, incluirFonteVencimentoCivil, referenciaVencimentoCivil } from "./vencimento-civil";

function inicioDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Escopo das comissões: financeiro/admin tudo; gerente as suas e as da equipe; vendedor as suas. */
function escopoComissoes(usuario: { id: string; papeis: Papel[] }): Prisma.ComissaoWhereInput {
  return usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.papeis.includes(Papel.FINANCEIRO) ? {} :
    usuario.papeis.includes(Papel.GERENTE_COMERCIAL) ? { OR: [{ vendedorId: usuario.id }, { vendedor: { gerenteComercialId: usuario.id } }] } : { vendedorId: usuario.id };
}

const ORDEM_COMISSOES = [{ vendedor: { nome: "asc" as const } }, { criadoEm: "desc" as const }, { id: "desc" as const }];

export const COMISSOES_POR_PAGINA = 50;

/**
 * Lista de /comissoes (E4): antes trazia todas as comissões do escopo de uma vez, sem filtro nem
 * página. Filtro por situação (em AND com o escopo), 50 por página, total filtrado.
 */
export async function listarComissoesPagina({ status, pagina }: { status: StatusComissao | null; pagina: number }) {
  const usuario = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.FINANCEIRO);
  const where: Prisma.ComissaoWhereInput = { AND: [escopoComissoes(usuario), status ? { status } : {}] };
  const [comissoes, total] = await Promise.all([
    prisma.comissao.findMany({
      where, orderBy: ORDEM_COMISSOES, skip: (pagina - 1) * COMISSOES_POR_PAGINA, take: COMISSOES_POR_PAGINA,
      include: { vendedor: { select: { nome: true } } },
    }),
    prisma.comissao.count({ where }),
  ]);
  return { itens: comissoes.map(resumirComissao), total };
}

/**
 * "A pagar (aprovadas)" da aba de comissões do /financeiro, agregado no banco por moeda sobre TODO o
 * escopo — com a lista paginada, somar só a página exibida daria um total errado.
 */
export async function totaisComissoesAPagar() {
  const usuario = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.FINANCEIRO);
  const grupos = await prisma.comissao.groupBy({
    by: ["moeda"],
    where: { AND: [escopoComissoes(usuario), { status: StatusComissao.APROVADA }] },
    _sum: { valor: true },
    orderBy: { moeda: "asc" },
  });
  return grupos.map((g) => ({ moeda: g.moeda, valor: numero(g._sum.valor ?? 0) }));
}

function resumirComissao(c: Prisma.ComissaoGetPayload<{ include: { vendedor: { select: { nome: true } } } }>) {
  return {
    id: c.id,
    vendedor: c.vendedor.nome,
    valor: numero(c.valor),
    moeda: c.moeda,
    percentual: numero(c.percentual),
    tipo: c.tipo,
    status: c.status,
    dataPrevistaPagamento: c.dataPrevistaPagamento ? c.dataPrevistaPagamento.toISOString() : null,
  };
}

export async function kpisFinanceiro() {
  await exigirSessaoComPapel(Papel.FINANCEIRO);
  const agora = new Date(); const ini = inicioDoMes();
  const [recebimentos, eventosLegados, abertas, comissoesAprovadas, novasMatriculas] = await Promise.all([
    prisma.recebimento.findMany({ where: { dataPagamento: { gte: ini, lte: agora } }, select: { valor: true, moeda: true } }),
    prisma.evento.findMany({ where: { tipo: "PagamentoRegistrado", criadoEm: { gte: ini, lte: agora } }, select: { agregadoId: true, payload: true } }),
    prisma.cobranca.findMany({ where: { status: { in: [StatusCobranca.PENDENTE, StatusCobranca.ATRASADO] } }, select: { valorNegociado: true, valorRecebido: true, valorLiquidadoCredito: true, valorCompensadoPermuta: true, vencimento: true, moeda: true, origensCreditoAcertoTaxaAditivo: { select: { valor: true } } } }),
    prisma.comissao.findMany({ where: { status: StatusComissao.APROVADA }, select: { valor: true, moeda: true } }),
    prisma.matricula.count({ where: { status: StatusMatricula.ATIVA, ativadaEm: { gte: ini } } }),
  ]);
  // Antes do ledger tipado, cada pagamento parcial era um evento. Preserva o histórico
  // sem contar duas vezes eventos já associados a um Recebimento.
  const legados = eventosLegados.filter((e) => { const p = e.payload as Record<string, unknown> | null; return p && !p.recebimentoId && typeof p.valorRecebido === "number"; });
  const moedas = await prisma.cobranca.findMany({ where: { id: { in: legados.map((e) => e.agregadoId) } }, select: { id: true, moeda: true } });
  const porId = new Map(moedas.map((c) => [c.id, c.moeda]));
  const recebidoMes = somarPorMoeda([
    ...recebimentos.map((r) => ({ moeda: r.moeda, valor: numero(r.valor) })),
    ...legados.filter((e) => porId.has(e.agregadoId)).map((e) => ({ moeda: porId.get(e.agregadoId)!, valor: (e.payload as { valorRecebido: number }).valorRecebido })),
  ]);
  const valores = (atrasadas: boolean) => somarPorMoeda(abertas.filter((c) => (c.vencimento < agora) === atrasadas).map((c) => ({ moeda: c.moeda, valor: saldoAtual(c.valorNegociado, c.valorRecebido, c.valorLiquidadoCredito, c.origensCreditoAcertoTaxaAditivo.reduce((total, origem) => total.plus(origem.valor), new Prisma.Decimal(0)), c.valorCompensadoPermuta).toNumber() })));
  return { recebidoMes, emAtraso: valores(true), aReceber: valores(false),
    comissoesAPagar: somarPorMoeda(comissoesAprovadas.map((c) => ({ moeda: c.moeda, valor: numero(c.valor) }))), novasMatriculas };
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
  await exigirSessaoComPapel(Papel.FINANCEIRO);
  const [paises, taxas] = await Promise.all([
    prisma.pais.findMany({ select: { moedaLocal: true } }),
    prisma.taxaCambio.findMany({ orderBy: { vigenteEm: "desc" } }),
  ]);
  const ultima = new Map<string, { unidadesPorUsd: number; vigenteEm: Date }>();
  for (const t of taxas) {
    const m = t.moeda.toUpperCase();
    if (!ultima.has(m)) ultima.set(m, { unidadesPorUsd: numero(t.unidadesPorUsd), vigenteEm: t.vigenteEm });
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
  const usuario = await exigirSessaoComPapel(Papel.GERENTE_COMERCIAL, Papel.FINANCEIRO);
  const global = usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.papeis.includes(Papel.FINANCEIRO);
  const equipe = global ? undefined : (await prisma.usuario.findMany({ where: { OR: [{ id: usuario.id }, { gerenteComercialId: usuario.id }] }, select: { id: true } })).map((u) => u.id);
  const filtro = equipe ? { vendedorId: { in: equipe } } : {};
  const [descPorMoeda, descPorVendedor, comissoes, comissoesVend, vendedores] = await Promise.all([
    prisma.ajusteFinanceiro.groupBy({ where: filtro, by: ["moeda"], _sum: { descontoValor: true }, _count: { _all: true } }),
    prisma.ajusteFinanceiro.groupBy({
      where: filtro,
      by: ["vendedorId", "moeda"],
      _sum: { descontoValor: true },
      _count: { _all: true },
    }),
    prisma.comissao.groupBy({ where: filtro, by: ["moeda", "status"], _sum: { valor: true }, _count: { _all: true } }),
    // Fase 2 (doc 03 §Comissão): relatório POR VENDEDOR (apuração por moeda × status).
    prisma.comissao.groupBy({
      where: filtro,
      by: ["vendedorId", "moeda", "status"],
      _sum: { valor: true },
      _count: { _all: true },
    }),
    prisma.usuario.findMany({ select: { id: true, nome: true } }),
  ]);
  const nome = new Map(vendedores.map((v) => [v.id, v.nome]));
  return {
    descontoPorMoeda: descPorMoeda
      .map((d) => ({ moeda: d.moeda, total: numeroOuNull(d._sum.descontoValor) ?? 0, qtd: d._count._all }))
      .sort((a, b) => b.total - a.total),
    descontoPorVendedor: descPorVendedor
      .filter((d) => d.vendedorId)
      .map((d) => ({ vendedor: nome.get(d.vendedorId!) ?? "—", moeda: d.moeda, total: numeroOuNull(d._sum.descontoValor) ?? 0, qtd: d._count._all }))
      .sort((a, b) => b.total - a.total),
    comissoesPorStatus: comissoes
      .map((c) => ({ moeda: c.moeda, status: c.status, total: numeroOuNull(c._sum.valor) ?? 0, qtd: c._count._all }))
      .sort((a, b) => a.moeda.localeCompare(b.moeda)),
    comissoesPorVendedor: comissoesVend
      .map((c) => ({
        vendedor: nome.get(c.vendedorId) ?? "—",
        moeda: c.moeda,
        status: c.status,
        total: numeroOuNull(c._sum.valor) ?? 0,
        qtd: c._count._all,
      }))
      .sort((a, b) => a.vendedor.localeCompare(b.vendedor) || a.moeda.localeCompare(b.moeda)),
  };
}

export async function listarInformesPagamento(alunoId?: string) {
  const usuario = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA);
  if (!alunoId && !usuario.papeis.some((papel) => papel === Papel.ADMINISTRADOR || papel === Papel.FINANCEIRO)) {
    throw new ErroPermissao("Consulte os informes no atendimento individual do aluno.");
  }
  const informes = await prisma.pagamentoInformado.findMany({
    where: { ...(alunoId ? { cobranca: { matricula: { alunoId } } } : { status: "A_CONFERIR" as const }) },
    orderBy: { criadoEm: "asc" },
    include: { cobranca: { select: { codigo: true, matricula: { select: { aluno: { select: { primeiroNome: true, sobrenome: true } } } } } } },
  });
  return semDecimais(informes.map((i) => ({
    id: i.id, versao: i.versao, valor: i.valor, moeda: i.moeda, forma: i.forma,
    aluno: `${i.cobranca.matricula.aluno.primeiroNome} ${i.cobranca.matricula.aluno.sobrenome}`, cobranca: i.cobranca.codigo,
    dataPagamento: i.dataPagamento.toISOString(), comprovanteUrl: i.comprovanteUrl, comprovanteNome: i.comprovanteNome,
    comentario: i.comentario, status: i.status, motivoConferencia: i.motivoConferencia,
    suspenderLembretesAte: i.suspenderLembretesAte?.toISOString() ?? null,
    podeConferir: i.autorId !== usuario.id && i.status === "A_CONFERIR" && (usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.papeis.includes(Papel.FINANCEIRO)),
  })));
}

/** Contextos operacionais para repartir um único fato de caixa FIN-04. */
export async function listarContextosRecebimentoDestinado() {
  await exigirSessaoComPapel(Papel.FINANCEIRO);
  const matriculas = await prisma.matricula.findMany({
    // A antecipação documentada pode ocorrer antes da ativação. Rascunhos e
    // matrículas encerradas/canceladas continuam fora do caixa operacional.
    where: { status: { in: [StatusMatricula.AGUARDANDO, StatusMatricula.ATIVA, StatusMatricula.PAUSADA] } }, orderBy: { aluno: { primeiroNome: "asc" } },
    include: { aluno: { select: { primeiroNome: true, sobrenome: true } }, pagadoresPreparacao: { orderBy: { versao: "desc" }, select: { id: true, tipo: true, versao: true } }, cobrancas: { where: { status: { in: [StatusCobranca.PENDENTE, StatusCobranca.ATRASADO] } }, orderBy: { vencimento: "asc" }, include: { origensCreditoAcertoTaxaAditivo: { select: { valor: true } }, ...incluirFonteVencimentoCivil } } },
  });
  const cobrancaIds = matriculas.flatMap((m) => m.cobrancas.map((c) => c.id));
  const matriculaIds = matriculas.map((m) => m.id);
  const { m01PorCobranca, vencimentosPorCobranca, retomadasReprogramadas } = await carregarTrilhasVencimentoCivil(prisma, cobrancaIds, matriculaIds);
  return matriculas.map((matricula) => {
    const cobrancas = matricula.cobrancas.flatMap((cobranca) => {
    const saldo = saldoAtual(cobranca.valorNegociado, cobranca.valorRecebido, cobranca.valorLiquidadoCredito, cobranca.origensCreditoAcertoTaxaAditivo.reduce((total, origem) => total.plus(origem.valor), new Prisma.Decimal(0)), cobranca.valorCompensadoPermuta).toNumber();
    return saldo > 0 ? [{ id: cobranca.id, codigo: cobranca.codigo, tipo: cobranca.tipo, vencimento: referenciaVencimentoCivil({ ...cobranca, aplicacoesAditivoVencimento: vencimentosPorCobranca.get(cobranca.id), aplicacoesM01: m01PorCobranca.get(cobranca.id), retomadasReprogramadas }), saldo }] : [];
    });
    const identificacaoMatricula = matricula.codigo?.trim() || `ID ${matricula.id}`;
    return { matriculaId: matricula.id, identificacaoMatricula, status: matricula.status, aluno: `${matricula.aluno.primeiroNome} ${matricula.aluno.sobrenome}`.trim(), moeda: matricula.moeda, cobrancas, pagadores: matricula.pagadoresPreparacao.map((p) => ({ id: p.id, rotulo: `${p.tipo} · versão ${p.versao}` })) };
  });
}

/** Quem configura a política de comissão: Administrador ou permissão `comissao.configurar`. Sem carregar a política. */
export async function podeConfigurarComissoes() {
  const usuario = await exigirSessaoComPapel(Papel.ADMINISTRADOR, Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL);
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return true;
  const atual = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id }, select: { permissoes: true } });
  return atual.permissoes.includes("comissao.configurar");
}

export async function configuracaoComissoes() {
  if (!(await podeConfigurarComissoes())) return null;
  const [politicas, paises, produtos] = await Promise.all([
    prisma.politicaComissao.findMany({ orderBy: { criadoEm: "desc" } }),
    prisma.pais.findMany({ where: { status: "ATIVO" }, select: { id: true, nome: true, moedaLocal: true } }),
    prisma.produto.findMany({ include: { idioma: { select: { nome: true } }, modalidade: { select: { nome: true } } } }),
  ]);
  return semDecimais({ politicas: politicas.map((p) => ({ ...p, vigenteEm: p.vigenteEm.toISOString(), encerraEm: p.encerraEm?.toISOString() ?? null, criadoEm: p.criadoEm.toISOString() })),
    paises, produtos: produtos.map((p) => ({ id: p.id, nome: `${p.idioma.nome} · ${p.modalidade.nome}` })) });
}

/** Config do financeiro automatizado (Fase 2) — defaults de fábrica quando sem registro. */
export async function carregarConfigFinanceiro() {
  await exigirSessaoComPapel(Papel.FINANCEIRO);
  const c = await prisma.configFinanceiro.findUnique({ where: { id: "financeiro" } });
  return { fechamentoComissaoAutomatico: c?.fechamentoComissaoAutomatico ?? false };
}
