import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";

/**
 * Recorte estável que integra o histórico imutável de uma correção. Datas são
 * serializadas aqui para que os dois fluxos de correção calculem o mesmo hash.
 */
export type ImpactoMudancaProgressao = {
  id: string;
  status: "APROVADA" | "EXECUTADA";
  turmaDestinoId: string;
  decididoEm: string | null;
  executadoEm: string | null;
};

type AplicacaoDaMesmaMatricula = {
  alocacaoOrigemId: string;
  alocacaoDestinoId: string;
  turmaOrigemId: string;
  turmaDestinoId: string;
  decisao: {
    aprovada: boolean;
    proposta: {
      matriculaId: string;
      alocacaoOrigemId: string;
      turmaOrigemId: string;
      turmaDestinoId: string;
    };
  };
  alocacaoOrigem: { matriculaId: string | null; turmaId: string };
  alocacaoDestino: { matriculaId: string | null; turmaId: string };
};

function aplicacaoEquivalenteDaMesmaMatricula(
  aplicacao: AplicacaoDaMesmaMatricula,
  matriculaId: string,
): boolean {
  const proposta = aplicacao.decisao.proposta;
  return aplicacao.decisao.aprovada
    && proposta.matriculaId === matriculaId
    && proposta.alocacaoOrigemId === aplicacao.alocacaoOrigemId
    && proposta.turmaOrigemId === aplicacao.turmaOrigemId
    && proposta.turmaDestinoId === aplicacao.turmaDestinoId
    && aplicacao.alocacaoOrigem.matriculaId === matriculaId
    && aplicacao.alocacaoDestino.matriculaId === matriculaId
    && aplicacao.alocacaoOrigem.turmaId === aplicacao.turmaOrigemId
    && aplicacao.alocacaoDestino.turmaId === aplicacao.turmaDestinoId;
}

/**
 * Retorna alocações alcançadas a partir da fonte corrigida, inclusive a própria
 * origem. A travessia segue somente fatos de
 * equivalência já aplicados: proposta aprovada -> aplicação -> nova alocação.
 * Nunca usa uma solicitação comum de mudança acadêmica como aresta da cadeia.
 */
export async function carregarAlocacoesAlcancadasPorEquivalenciaTx(
  tx: Prisma.TransactionClient,
  entrada: { matriculaId: string; alocacaoOrigemId: string },
): Promise<Set<string>> {
  const origem = await tx.alocacaoTurma.findFirst({
    where: { id: entrada.alocacaoOrigemId, matriculaId: entrada.matriculaId }, select: { id: true },
  });
  if (!origem) throw new ErroRegra("Confira a matrícula da fonte de correção.");
  const aplicacoes = await tx.aplicacaoEquivalenciaAvaliacao.findMany({
    where: { matriculaId: entrada.matriculaId },
    orderBy: [{ aplicadaEm: "asc" }, { id: "asc" }],
    select: {
      alocacaoOrigemId: true,
      alocacaoDestinoId: true,
      turmaOrigemId: true,
      turmaDestinoId: true,
      decisao: { select: {
        aprovada: true,
        proposta: { select: {
          matriculaId: true,
          alocacaoOrigemId: true,
          turmaOrigemId: true,
          turmaDestinoId: true,
        } },
      } },
      alocacaoOrigem: { select: { matriculaId: true, turmaId: true } },
      alocacaoDestino: { select: { matriculaId: true, turmaId: true } },
    },
  });

  const porOrigem = new Map<string, AplicacaoDaMesmaMatricula[]>();
  for (const aplicacao of aplicacoes) {
    if (!aplicacaoEquivalenteDaMesmaMatricula(aplicacao, entrada.matriculaId)) continue;
    const seguintes = porOrigem.get(aplicacao.alocacaoOrigemId) ?? [];
    seguintes.push(aplicacao);
    porOrigem.set(aplicacao.alocacaoOrigemId, seguintes);
  }

  // Uma aplicação de destino é única. Ainda assim, o conjunto protege contra
  // dados históricos cíclicos e torna a travessia idempotente.
  const alocacoesAfetadas = new Set<string>([entrada.alocacaoOrigemId]);
  const pendentes = [entrada.alocacaoOrigemId];
  for (let atual = pendentes.shift(); atual; atual = pendentes.shift()) {
    for (const aplicacao of porOrigem.get(atual) ?? []) {
      if (alocacoesAfetadas.has(aplicacao.alocacaoDestinoId)) continue;
      alocacoesAfetadas.add(aplicacao.alocacaoDestinoId);
      pendentes.push(aplicacao.alocacaoDestinoId);
    }
  }

  return alocacoesAfetadas;
}

export async function carregarImpactosProgressaoPorAproveitamentoTx(
  tx: Prisma.TransactionClient,
  entrada: { matriculaId: string; alocacaoOrigemId: string },
): Promise<ImpactoMudancaProgressao[]> {
  const alocacoesAfetadas = await carregarAlocacoesAlcancadasPorEquivalenciaTx(tx, entrada);
  const impactos = await tx.solicitacaoMudancaAcademica.findMany({
    where: {
      OR: [
        { matriculaId: entrada.matriculaId, alocacaoOrigemId: { in: [...alocacoesAfetadas] } },
        // Não atribuir uma matrícula a um registro legado. Apenas conservar a
        // revisão direta da sua origem, como no comportamento anterior.
        { matriculaId: null, alocacaoOrigemId: entrada.alocacaoOrigemId },
      ],
      status: { in: ["APROVADA", "EXECUTADA"] },
    },
    orderBy: { id: "asc" },
    select: { id: true, status: true, turmaDestinoId: true, decididoEm: true, executadoEm: true },
  });
  return impactos.map((impacto) => {
    if (impacto.status !== "APROVADA" && impacto.status !== "EXECUTADA") {
      throw new ErroRegra("O impacto acadêmico não está em estado aprovado ou executado.");
    }
    return {
      id: impacto.id,
      status: impacto.status,
      turmaDestinoId: impacto.turmaDestinoId,
      decididoEm: impacto.decididoEm?.toISOString() ?? null,
      executadoEm: impacto.executadoEm?.toISOString() ?? null,
    };
  });
}
