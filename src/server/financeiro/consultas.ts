import { StatusCobranca, StatusComissao, StatusMatricula } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function inicioDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function listarCobrancasAbertas() {
  const cobrancas = await prisma.cobranca.findMany({
    where: { status: { in: [StatusCobranca.PENDENTE, StatusCobranca.ATRASADO] } },
    orderBy: { vencimento: "asc" },
    include: {
      matricula: {
        include: {
          aluno: {
            include: {
              alocacoes: {
                where: { ativa: true },
                take: 1,
                include: { turma: { include: { modalidade: true, nivel: true } } },
              },
            },
          },
        },
      },
    },
  });

  // Última cobrança manual + nº de tentativas (projeção do evento CobrancaEnviadaWhatsApp).
  const ids = cobrancas.map((c) => c.id);
  const tentativasRaw = ids.length
    ? await prisma.evento.groupBy({
        by: ["agregadoId"],
        where: { agregadoTipo: "Cobranca", tipo: "CobrancaEnviadaWhatsApp", agregadoId: { in: ids } },
        _count: { _all: true },
        _max: { criadoEm: true },
      })
    : [];
  const mapTent = new Map(tentativasRaw.map((t) => [t.agregadoId, t]));

  const agora = new Date();
  return cobrancas.map((c) => {
    const aluno = c.matricula.aluno;
    const turma = aluno.alocacoes[0]?.turma ?? null;
    const tent = mapTent.get(c.id);
    return {
      id: c.id,
      codigo: c.codigo,
      tipo: c.tipo,
      valorNegociado: c.valorNegociado,
      valorRecebido: c.valorRecebido ?? 0,
      saldo: c.saldo ?? c.valorNegociado - (c.valorRecebido ?? 0),
      moeda: c.moeda,
      vencimento: c.vencimento.toISOString(),
      atrasado: c.status === StatusCobranca.ATRASADO || c.vencimento < agora,
      tentativasCobranca: tent?._count._all ?? 0,
      ultimaCobrancaEm: tent?._max.criadoEm ? tent._max.criadoEm.toISOString() : null,
      aluno: { id: aluno.id, nome: aluno.nome, telefone: aluno.telefoneE164 },
      turma: turma ? `${turma.modalidade.nome} ${turma.nivel.codigo}` : null,
    };
  });
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
      select: { valorRecebido: true, valorNegociado: true },
    }),
    prisma.cobranca.findMany({
      where: { status: { in: [StatusCobranca.PENDENTE, StatusCobranca.ATRASADO] } },
      select: { valorNegociado: true, vencimento: true },
    }),
    prisma.comissao.findMany({
      where: { status: StatusComissao.APROVADA },
      select: { valor: true },
    }),
    prisma.matricula.count({ where: { status: StatusMatricula.ATIVA, ativadaEm: { gte: ini } } }),
  ]);

  const recebidoMes = pagasMes.reduce((s, c) => s + (c.valorRecebido ?? c.valorNegociado), 0);
  const emAtraso = abertas.filter((c) => c.vencimento < agora).reduce((s, c) => s + c.valorNegociado, 0);
  const aReceber = abertas.filter((c) => c.vencimento >= agora).reduce((s, c) => s + c.valorNegociado, 0);
  const comissoesAPagar = comissoesAprovadas.reduce((s, c) => s + c.valor, 0);

  return { recebidoMes, emAtraso, aReceber, comissoesAPagar, novasMatriculas };
}
