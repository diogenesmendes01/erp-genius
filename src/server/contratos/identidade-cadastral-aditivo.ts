import type { Prisma } from "@prisma/client";
import type { OrigemCampo } from "./campos";
import { validarValorAlteracaoAditivo, representarValorAlteracaoAditivo } from "./aditivo-valores";
import { ErroRegra } from "@/server/_shared";

/** Identidade contratual para conferência. A proposta aprovada não altera a conta do aluno. */
export function identidadeCadastralAditivo<T extends { nome?: string | null; email?: string | null; documento?: string | null }>(
  base: T, prefixo: "ALUNO" | "PAGADOR", anteriores: Prisma.JsonValue | null,
  alteracoes: readonly { origem: OrigemCampo; novo: string; valorEstruturado?: unknown }[],
) {
  const identidade = { ...base };
  const mapa = { NOME: "nome", EMAIL: "email", DOCUMENTO: "documento" } as const;
  for (const [sufixo, propriedade] of Object.entries(mapa)) {
    const origem = `${prefixo}_${sufixo}` as OrigemCampo;
    const anterior = anteriores && !Array.isArray(anteriores) && typeof anteriores === "object" ? anteriores[origem] : undefined;
    if (anterior !== undefined) identidade[propriedade] = representarValorAlteracaoAditivo(validarValorAlteracaoAditivo(origem, anterior));
    const alteracao = alteracoes.find(a => a.origem === origem);
    if (!alteracao) continue;
    if (alteracao.valorEstruturado !== undefined) {
      const novo = representarValorAlteracaoAditivo(validarValorAlteracaoAditivo(origem, alteracao.valorEstruturado));
      if (novo !== alteracao.novo) throw new ErroRegra("Identidade estruturada diverge da alteração aprovada.");
      identidade[propriedade] = novo;
    } else if (alteracao.novo !== identidade[propriedade]?.trim()) {
      throw new ErroRegra("Estruture a alteração cadastral antes de conferir os signatários.");
    }
  }
  return identidade;
}
