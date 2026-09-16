import { z } from "zod";
import { Prisma } from "@prisma/client";
import { Entrada } from "@/server/secretaria/condicoes-entrada-schema";
import { ErroRegra } from "@/server/_shared/sessao";
import { periodoMensalNaData } from "./cobertura";
import { calcularAdiantamentoProposto } from "./adiantamento-proposto";

const valor = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/);
const Snapshot = Entrada.pick({ taxaVencimento: true, aulas: true }).extend({
  moeda: z.string().min(1), taxaProposta: valor, valorServicoProposto: valor,
  politicaEntrada: z.object({ taxaPreviaAssinatura: z.boolean(), exigirPrimeiraMensalidade: z.boolean().nullable().optional(), adiantamentoHoraExigido: z.boolean().nullable() }),
  adiantamentoProposto: z.object({ minutos: z.number().int().positive(), valor: valor, valorHora: valor, unidadeMinutos: z.literal(60) }).nullable(),
}).strip();
export type CobrancaEntradaPlanejada = { tipo: "MATRICULA" | "MENSALIDADE" | "HORA_PARTICULAR"; etapa: "CONFERENCIA_SECRETARIA" | "ATIVACAO";
  valor: string; moeda: string; vencimento: string; cobertura: { inicio: string; fim: string; dias: number } | null; minutos: number | null };

/** Q112/Q119: plano sem efeitos. O emissor deve revalidar versões, autorização e idempotência. */
export function planejarCobrancasEntrada(snapshot: unknown): CobrancaEntradaPlanejada[] {
  const parse = Snapshot.safeParse(snapshot);
  if (!parse.success) throw new ErroRegra("Condições insuficientes para planejar as cobranças iniciais.");
  const d = parse.data;
  const itens: CobrancaEntradaPlanejada[] = [{ tipo: "MATRICULA", etapa: "CONFERENCIA_SECRETARIA", valor: d.taxaProposta, moeda: d.moeda, vencimento: d.taxaVencimento, cobertura: null, minutos: null }];
  if (d.aulas.regime === "MENSALIDADE") {
    if (d.politicaEntrada.exigirPrimeiraMensalidade == null || d.adiantamentoProposto) throw new ErroRegra("Confira as condições de entrada da mensalidade.");
    const c = d.aulas.cobertura;
    const cobertura = periodoMensalNaData(c.referencia === "MES_CIVIL" ? { referencia: "MES_CIVIL" } : { referencia: "CICLO_MATRICULA", dataReferencia: c.inicio }, c.inicio);
    itens.push({ tipo: "MENSALIDADE", etapa: d.politicaEntrada.exigirPrimeiraMensalidade ? "CONFERENCIA_SECRETARIA" : "ATIVACAO", valor: d.valorServicoProposto, moeda: d.moeda, vencimento: d.aulas.primeiroVencimento, cobertura, minutos: null });
  } else {
    if (d.politicaEntrada.adiantamentoHoraExigido == null) throw new ErroRegra("Confira a regra de adiantamento por hora.");
    const a = d.adiantamentoProposto;
    if (!a) {
      if (d.politicaEntrada.adiantamentoHoraExigido || d.aulas.vencimentoAdiantamento) throw new ErroRegra("A antecipação precisa ter tempo, valor e vencimento identificados.");
    } else {
      const calculado = calcularAdiantamentoProposto("HORA_PARTICULAR", a.minutos, d.valorServicoProposto, d.politicaEntrada.adiantamentoHoraExigido);
      if (!d.aulas.vencimentoAdiantamento || !calculado || !new Prisma.Decimal(a.valor).equals(calculado.valor) || !new Prisma.Decimal(a.valorHora).equals(d.valorServicoProposto)) throw new ErroRegra("O valor ou vencimento do adiantamento difere das condições propostas.");
      itens.push({ tipo: "HORA_PARTICULAR", etapa: "CONFERENCIA_SECRETARIA", valor: calculado.valor, moeda: d.moeda, vencimento: d.aulas.vencimentoAdiantamento, cobertura: null, minutos: a.minutos });
    }
  }
  return itens;
}
