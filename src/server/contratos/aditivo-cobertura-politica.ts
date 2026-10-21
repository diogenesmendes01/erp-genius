import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { CicloCoberturaFuturoAditivoSchema, PrepararAditivoContratualSchema } from "./aditivo-schema";
import { hashSubstituicao } from "./substituicao-estado";

export type PoliticaCoberturaAditivo = z.output<typeof CicloCoberturaFuturoAditivoSchema>;
export function extrairLimitesCoberturaFormalizada(snapshot: unknown, entradaHash: string) {
  extrairPoliticaCoberturaFormalizada(snapshot, entradaHash);
  const entrada = z.object({ entrada: PrepararAditivoContratualSchema }).parse(snapshot).entrada;
  const inicio = entrada.alteracoes.find(a => a.origem === "COBERTURA_INICIO")?.valorEstruturado;
  const fim = entrada.alteracoes.find(a => a.origem === "COBERTURA_FIM")?.valorEstruturado;
  if (inicio?.tipo !== "DATA" || fim?.tipo !== "DATA" || inicio.data > fim.data) throw new ErroRegra("Limites de cobertura formalizados inválidos.");
  return { inicio: inicio.data, fim: fim.data };
}
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
