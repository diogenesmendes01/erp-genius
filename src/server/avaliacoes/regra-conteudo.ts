import { ErroRegra } from "@/server/_shared/sessao";
import { ConteudoRegraAvaliacaoSchema, type ConteudoRegraAvaliacao } from "./regra-schema";

export const MENSAGEM_REGRA_FORMATO_ANTIGO = "Regra de avaliação em formato antigo. Publique uma nova versão para este nível.";
export const MENSAGEM_VERSAO_ILEGIVEL = "Versão em formato antigo — conteúdo indisponível para revisão";

/**
 * Leitura estrita para cálculo, decisão e migração (fail-closed, #530): só aceita conteúdo
 * válido no schema atual. Nunca usa os defaults de compatibilidade da exibição.
 */
export function exigirConteudoRegra(raw: unknown): ConteudoRegraAvaliacao {
  const r = ConteudoRegraAvaliacaoSchema.safeParse(raw);
  if (!r.success) throw new ErroRegra(MENSAGEM_REGRA_FORMATO_ANTIGO);
  return r.data;
}
