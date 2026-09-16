import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";

/** Consulta compartilhada pela apresentação e pela proteção das ações legadas. */
export async function impedimentoFluxoGlobal(tx: Pick<Prisma.TransactionClient, "matricula">, alunoId: string): Promise<string | null> {
  const totalContratos = await tx.matricula.count({ where: { alunoId } });
  if (totalContratos > 1) return "Este aluno possui mais de uma matrícula. Use o fluxo contratual e selecione os contratos que deseja alterar.";
  const contratos = await tx.matricula.count({ where: { alunoId, OR: [
    { preparacaoComercial: { isNot: null } },
    { alocacoes: { some: {} } },
    { condicoesHoras: { some: {} } },
    { comprasHoras: { some: {} } },
    { status: "PAUSADA" },
    { itensSolicitacaoEncerramento: { some: { solicitacao: { status: { in: ["ABERTA", "EM_ACERTO", "CONCLUIDA"] } } } } },
    { itensPropostaPausa: { some: { proposta: { status: { in: ["PENDENTE", "APROVADA", "APLICADA"] } } } } },
    { itensPropostaRetomadaContratual: { some: { proposta: { status: { in: ["PENDENTE", "APROVADA", "APLICADA"] } } } } },
  ] } });
  if (contratos) return "Este aluno possui vínculos ou movimentação por matrícula. Use o fluxo contratual; a operação global antiga não pode alterar seus contratos.";
  return null;
}

/** Chamar sob os locks do aluno/contratos antes de uma alteração global legada. */
export async function exigirFluxoGlobalSemMovimentacaoContratual(tx: Pick<Prisma.TransactionClient, "matricula">, alunoId: string) {
  const impedimento = await impedimentoFluxoGlobal(tx, alunoId);
  if (impedimento) throw new ErroRegra(impedimento);
}
