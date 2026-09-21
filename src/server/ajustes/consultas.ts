import { Papel, Prisma, StatusCobranca, StatusAprovacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { somarPorMoeda } from "@/lib/dinheiro";
import { semDecimais } from "@/server/_shared/decimal";
import type { UsuarioSessao } from "@/server/_shared";
import { montarReguaPorCobranca, historicoFinanceiroDoAluno } from "@/server/cobrancas/consultas";

import { exigirSessaoComPapel, exigirPapel } from "@/server/_shared";
import { financeiroOperacional, escopoMatriculaComercial, escopoMatriculaAprovacao } from "@/server/financeiro/acesso";
import { saldoAtual } from "@/server/financeiro/regras";
import { carregarTrilhasVencimentoCivil, incluirFonteVencimentoCivil, referenciaVencimentoCivil } from "@/server/financeiro/vencimento-civil";

/** Ausência de identidade e vínculo nunca concede acesso global. */
export function escopoFichaFinanceira(usuario?: UsuarioSessao): Prisma.AlunoWhereInput {
  return usuario && financeiroOperacional(usuario) ? {} : { id: { in: [] } };
}

export async function obterFichaFinanceira(alunoId: string, usuario?: UsuarioSessao) {
  const atual = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA);
  if (usuario && usuario.id !== atual.id) return null;
  usuario = atual;
  const podeComissao = usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.papeis.includes(Papel.FINANCEIRO);
  const aluno = await prisma.aluno.findFirst({
    where: { id: alunoId, ...escopoFichaFinanceira(usuario) },
    select: {
      id: true, codigo: true, primeiroNome: true, sobrenome: true,
      pais: { select: { nome: true } },
      responsaveis: { where: { papel: "FINANCEIRO" }, select: { papel: true, responsavel: { select: { nome: true } } } },
      matriculas: {
        include: {
          cobrancas: {
            orderBy: { vencimento: "asc" },
            include: {
              origensCreditoAcertoTaxaAditivo: { select: { valor: true } },
              ...incluirFonteVencimentoCivil,
              aplicacoesPeriodoIntegral: {
                orderBy: [{ aplicadaEm: "desc" }, { id: "desc" }],
                take: 1,
                select: {
                  aplicadaEm: true,
                  decisao: { select: { proposta: { select: { escolha: true } } } },
                },
              },
            },
          },
          comissoes: { where: podeComissao ? {} : { id: { in: [] } }, include: { vendedor: { select: { nome: true } } } },
          ajustes: { orderBy: { criadoEm: "desc" }, include: { autor: { select: { nome: true } } } },
          produto: { include: { idioma: true, modalidade: true } },
          lead: { select: { vendedorDonoId: true } },
        },
      },
    },
  });
  if (!aluno) return null;

  // Borda Server → Client: Decimal (dinheiro no banco) vira number aqui, antes de
  // qualquer soma/serialização — ver `_shared/decimal`.
  const alunoPlano = semDecimais(aluno);
  const cobrancas = alunoPlano.matriculas.flatMap((m) => m.cobrancas);
  const trilhasVencimento = await carregarTrilhasVencimentoCivil(prisma, cobrancas.map((c) => c.id), alunoPlano.matriculas.map((m) => m.id));
  const referenciaVencimentoPorCobranca = new Map(cobrancas.map((c) => [c.id, referenciaVencimentoCivil({
    ...c,
    aplicacoesAditivoVencimento: trilhasVencimento.vencimentosPorCobranca.get(c.id),
    aplicacoesM01: trilhasVencimento.m01PorCobranca.get(c.id),
    retomadasReprogramadas: trilhasVencimento.retomadasReprogramadas,
  })]));
  const ajustes = alunoPlano.matriculas.flatMap((m) => m.ajustes);
  const comissoes = alunoPlano.matriculas.flatMap((m) => m.comissoes);
  const agora = new Date();

  // Por moeda (nunca soma moedas diferentes) — o aluno pode ter matrículas em moedas distintas.
  const emAtraso = somarPorMoeda(
    cobrancas
      .filter((c) => c.status === StatusCobranca.ATRASADO || (c.status === StatusCobranca.PENDENTE && c.vencimento < agora))
      .map((c) => ({ moeda: c.moeda, valor: saldoAtual(c.valorNegociado, c.valorRecebido, c.valorLiquidadoCredito, c.origensCreditoAcertoTaxaAditivo.reduce((total, origem) => total.plus(origem.valor), new Prisma.Decimal(0)), c.valorCompensadoPermuta).toNumber() })),
  );
  const emAberto = somarPorMoeda(
    cobrancas
      .filter((c) => c.status === StatusCobranca.PENDENTE || c.status === StatusCobranca.ATRASADO)
      .map((c) => ({ moeda: c.moeda, valor: saldoAtual(c.valorNegociado, c.valorRecebido, c.valorLiquidadoCredito, c.origensCreditoAcertoTaxaAditivo.reduce((total, origem) => total.plus(origem.valor), new Prisma.Decimal(0)), c.valorCompensadoPermuta).toNumber() })),
  );
  const proximo = cobrancas
    .filter((c) => c.status === StatusCobranca.PENDENTE && c.vencimento >= agora)
    .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())[0] ?? null;
  const ultimoPago = cobrancas
    .filter((c) => c.status === StatusCobranca.PAGO && c.pagoEm)
    .sort((a, b) => (b.pagoEm!.getTime() ?? 0) - (a.pagoEm!.getTime() ?? 0))[0] ?? null;

  const responsavelFinanceiro =
    aluno.responsaveis.find((r) => r.papel === "FINANCEIRO")?.responsavel.nome ?? "O próprio aluno";

  // Régua (read-only) por cobrança ABERTA + histórico financeiro: a ficha passa a contar a
  // MESMA história da fila de cobrança, via o cérebro compartilhado, sem ganhar ações (doc 24).
  const reguaPorCobranca = await montarReguaPorCobranca(
    alunoPlano.matriculas.flatMap((m) =>
      m.cobrancas
        .filter((c) => c.status === StatusCobranca.PENDENTE || c.status === StatusCobranca.ATRASADO)
        .map((c) => ({ id: c.id, vencimento: c.vencimento, cicloRegua: c.cicloRegua, acessoBloqueado: m.acessoBloqueado })),
    ),
    agora,
  );
  const acessoBloqueado = alunoPlano.matriculas.some((m) => m.acessoBloqueado);
  const historico = await historicoFinanceiroDoAluno(
    cobrancas.map((c) => c.id),
    alunoPlano.matriculas.map((m) => m.id),
  );

  return {
    aluno: alunoPlano,
    cobrancas,
    ajustes,
    comissoes,
    responsavelFinanceiro,
    emAtraso,
    emAberto,
    proximo,
    ultimoPago,
    acessoBloqueado,
    reguaPorCobranca,
    historico,
    referenciaVencimentoPorCobranca,
  };
}

export async function listarAprovacoesPendentes() {
  const usuario = await exigirSessaoComPapel(Papel.GERENTE_COMERCIAL, Papel.FINANCEIRO);
  if (!usuario.papeis.includes(Papel.ADMINISTRADOR) && !usuario.papeis.includes(Papel.GERENTE_COMERCIAL)) return [];
  const adm = usuario.papeis.includes(Papel.ADMINISTRADOR);
  const matriculas = adm ? [] : await prisma.matricula.findMany({
    where: await escopoMatriculaAprovacao(usuario), select: { id: true, cobrancas: { select: { id: true } } },
  });
  // A carteira pode mudar depois do pedido. O solicitante histórico sozinho não
  // autoriza ler valores de um objeto que saiu da equipe supervisionada.
  const objetos: Prisma.AprovacaoWhereInput = adm ? {} : { OR: [
    { alvoTipo: "Matricula", alvoId: { in: matriculas.map((m) => m.id) } },
    { alvoTipo: "Cobranca", alvoId: { in: matriculas.flatMap((m) => m.cobrancas.map((c) => c.id)) } },
  ], payload: { path: ["exigeDirecao"], equals: false } };
  const aprovacoes = await prisma.aprovacao.findMany({
    where: {
      status: StatusAprovacao.PENDENTE, solicitanteId: { not: usuario.id },
      tipo: { in: adm ? ["DESCONTO", "BOLSA", "ALTERACAO_VALOR", "PERDAO_DIVIDA"] : ["DESCONTO", "ALTERACAO_VALOR"] },
      AND: [{ alvoTipo: { in: ["Matricula", "Cobranca"] } }, objetos],
    },
    orderBy: { criadoEm: "asc" },
    include: { solicitante: { select: { nome: true } } },
  });
  return semDecimais(aprovacoes); // impactoMensal: Decimal → number (borda Server → Client)
}

/** Contexto da negociação: não contém saldo, inadimplência, comprovantes ou extrato. */
export async function obterResumoComercialFinanceiro(alunoId: string, usuario: UsuarioSessao) {
  const atual = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
  if (atual.id !== usuario.id) return null;
  exigirPapel(atual, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
  const matriculas = await prisma.matricula.findMany({
    where: { AND: [{ alunoId }, await escopoMatriculaComercial(atual)] },
    select: {
      id: true, codigo: true, moeda: true, status: true,
      aluno: { select: { id: true, primeiroNome: true, sobrenome: true } },
      produto: { select: { idioma: { select: { nome: true } }, modalidade: { select: { nome: true } } } },
      cobrancas: { where: { tipo: { in: ["MATRICULA", "MENSALIDADE"] } }, orderBy: { vencimento: "asc" }, select: { id: true, tipo: true, valorOriginal: true, valorNegociado: true, status: true } },
      comissoes: { where: atual.papeis.includes(Papel.ADMINISTRADOR) ? {} : atual.papeis.includes(Papel.GERENTE_COMERCIAL) ? { OR: [{ vendedorId: atual.id }, { vendedor: { gerenteComercialId: atual.id } }] } : { vendedorId: atual.id }, select: { id: true, valor: true, moeda: true, tipo: true, percentual: true, status: true } },
    },
  });
  if (!matriculas.length) return null;
  const pedidos = await prisma.aprovacao.findMany({ where: { alvoTipo: "Matricula", alvoId: { in: matriculas.map((m) => m.id) }, status: "PENDENTE" }, select: { alvoId: true } });
  const pendentes = new Set(pedidos.map((p) => p.alvoId));
  return semDecimais({ aluno: matriculas[0].aluno, matriculas: matriculas.map((m) => ({
    id: m.id, codigo: m.codigo, moeda: m.moeda, status: m.status, precoAguardandoAprovacao: pendentes.has(m.id),
    produto: `${m.produto.idioma.nome} · ${m.produto.modalidade.nome}`,
    pagamentoInicialConfirmado: m.cobrancas.find((c) => c.tipo === "MATRICULA")?.status === "PAGO",
    precos: (["MATRICULA", "MENSALIDADE"] as const).flatMap((tipo) => {
      const c = m.cobrancas.find((c) => c.tipo === tipo);
      return c ? [{ id: c.id, tipo, referencia: c.valorOriginal, valor: c.valorNegociado }] : [];
    }), comissoes: m.comissoes,
  })) });
}
