import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { CicloCoberturaFuturoAditivoSchema, PrepararAditivoContratualSchema } from "./aditivo-schema";
import { hashSubstituicao } from "./substituicao-estado";

export type PoliticaCoberturaAditivo = z.output<typeof CicloCoberturaFuturoAditivoSchema>;
/** Lê somente o campo que integrou o snapshot assinado; tela financeira não o altera. */
export function extrairPoliticaCoberturaFormalizada(snapshot: unknown, entradaHash: string): PoliticaCoberturaAditivo {
  if (hashSubstituicao(snapshot as Prisma.JsonValue) !== entradaHash) throw new ErroRegra("A proposta assinada perdeu sua integridade.");
  const entrada = z.object({ entrada: PrepararAditivoContratualSchema }).parse(snapshot).entrada;
  const origens = new Set(entrada.alteracoes.map(a => a.origem));
  if (!origens.has("COBERTURA_INICIO") || !origens.has("COBERTURA_FIM") || !entrada.cicloCoberturaFutura) {
    throw new ErroRegra("A proposta assinada não formaliza a política de ciclos da correção de cobertura.");
  }
  return entrada.cicloCoberturaFutura;
}
