import { StatusCobranca, StatusAprovacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function obterFichaFinanceira(alunoId: string) {
  const aluno = await prisma.aluno.findUnique({
    where: { id: alunoId },
    include: {
      pais: { select: { nome: true } },
      responsaveis: { include: { responsavel: true } },
      matriculas: {
        include: {
          cobrancas: { orderBy: { vencimento: "asc" } },
          comissoes: { include: { vendedor: { select: { nome: true } } } },
          ajustes: { orderBy: { criadoEm: "desc" }, include: { autor: { select: { nome: true } } } },
          produto: { include: { idioma: true, modalidade: true } },
        },
      },
    },
  });
  if (!aluno) return null;

  const cobrancas = aluno.matriculas.flatMap((m) => m.cobrancas);
  const ajustes = aluno.matriculas.flatMap((m) => m.ajustes);
  const comissoes = aluno.matriculas.flatMap((m) => m.comissoes);
  const agora = new Date();

  const emAtraso = cobrancas
    .filter((c) => c.status === StatusCobranca.ATRASADO || (c.status === StatusCobranca.PENDENTE && c.vencimento < agora))
    .reduce((s, c) => s + c.valorNegociado, 0);
  const emAberto = cobrancas
    .filter((c) => c.status === StatusCobranca.PENDENTE || c.status === StatusCobranca.ATRASADO)
    .reduce((s, c) => s + c.valorNegociado, 0);
  const proximo = cobrancas
    .filter((c) => c.status === StatusCobranca.PENDENTE && c.vencimento >= agora)
    .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())[0] ?? null;
  const ultimoPago = cobrancas
    .filter((c) => c.status === StatusCobranca.PAGO && c.pagoEm)
    .sort((a, b) => (b.pagoEm!.getTime() ?? 0) - (a.pagoEm!.getTime() ?? 0))[0] ?? null;

  const responsavelFinanceiro =
    aluno.responsaveis.find((r) => r.papel === "FINANCEIRO")?.responsavel.nome ?? "O próprio aluno";

  return { aluno, cobrancas, ajustes, comissoes, responsavelFinanceiro, emAtraso, emAberto, proximo, ultimoPago };
}

export async function listarAprovacoesPendentes() {
  return prisma.aprovacao.findMany({
    where: { status: StatusAprovacao.PENDENTE },
    orderBy: { criadoEm: "asc" },
    include: { solicitante: { select: { nome: true } } },
  });
}
