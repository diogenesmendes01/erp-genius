import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";

/** Origens acadêmicas da contratação revisada; não encerra vínculo nem cancela encontro. */
export async function carregarImpactosAcademicosEncerramentoTx(tx: Prisma.TransactionClient, alunoId: string, matriculaId: string) {
  const m = await tx.matricula.findFirst({ where: { id: matriculaId, alunoId }, select: {
    status: true, ativadaEm: true, acessoVersao: true,
    preparacaoComercial: { select: { regime: true } },
    alocacoes: { orderBy: { id: "asc" }, select: { id: true, turmaId: true, ativa: true, criadoEm: true, encerradaEm: true } },
    encontrosAgenda: { orderBy: { id: "asc" }, select: { id: true, finalidade: true, inicio: true, fim: true, status: true, professorId: true, fusoOrigem: true,
      reservasHoras: { orderBy: { id: "asc" }, select: { id: true, compraId: true, minutos: true } },
    } },
  } });
  if (!m) throw new ErroRegra("Matrícula não encontrada para este aluno.");
  const recuperacoes = m.encontrosAgenda.filter(e => e.finalidade === "RECUPERACAO").map(e => ({ id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), status: e.status, professorId: e.professorId, fusoOrigem: e.fusoOrigem }));
  return { matriculaId, regimeCobranca: m.preparacaoComercial?.regime ?? null, status: m.status, ativadaEm: m.ativadaEm?.toISOString() ?? null, acessoVersao: m.acessoVersao,
    vinculos: m.alocacoes.map(a => ({ ...a, criadoEm: a.criadoEm.toISOString(), encerradaEm: a.encerradaEm?.toISOString() ?? null })),
    encontrosParticulares: m.encontrosAgenda.filter(e => e.finalidade === "AULA").map(({ finalidade: _finalidade, ...e }) => { void _finalidade; return { ...e, inicio: e.inicio.toISOString(), fim: e.fim.toISOString() }; }),
    ...(recuperacoes.length ? { encontrosRecuperacao: recuperacoes } : {}),
  };
}
