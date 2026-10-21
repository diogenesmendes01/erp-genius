import { z } from "zod";
import { DataCivilSchema, periodoMensalNaData, RegraCoberturaSchema } from "./cobertura";

const periodo = z.object({ inicio: DataCivilSchema, fim: DataCivilSchema }).strict()
  .refine((p) => p.inicio <= p.fim, "Cobertura invertida.");
const entrada = z.object({
  retorno: DataCivilSchema,
  regra: RegraCoberturaSchema,
  suspensos: z.array(z.object({ cobrancaId: z.string().min(1), cobertura: periodo, vencimento: DataCivilSchema }).strict()),
  mantidos: z.array(periodo),
  vencimentos: z.discriminatedUnion("opcao", [
    z.object({ opcao: z.literal("MANTER_VENCIMENTOS") }).strict(),
    z.object({ opcao: z.literal("REPROGRAMAR_PARCELAS"), datas: z.array(z.object({ cobrancaId: z.string().min(1), vencimento: DataCivilSchema }).strict()) }).strict(),
  ]),
}).strict();
export type EntradaRetomadaCobertura = z.input<typeof entrada>;
const seguinte = (s: string) => new Date(new Date(`${s}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
const sobrepoe = (a: { inicio: string; fim: string }, b: { inicio: string; fim: string }) => a.inicio <= b.fim && b.inicio <= a.fim;

/** Q66: preparar coberturas e vencimentos na mesma proposta, sem modificar cobranças.
 * Mantidos são os períodos válidos que já continuam devidos integralmente pela pausa.
 */
export function prepararCoberturasRetomada(input: EntradaRetomadaCobertura) {
  const dados = entrada.parse(input);
  const ids = dados.suspensos.map((p) => p.cobrancaId);
  if (new Set(ids).size !== ids.length) throw new Error("Cobrança repetida na seleção.");
  const ordenados = [...dados.suspensos].sort((a, b) => a.cobertura.inicio.localeCompare(b.cobertura.inicio));
  for (let i = 1; i < ordenados.length; i++) {
    if (sobrepoe(ordenados[i - 1].cobertura, ordenados[i].cobertura)) throw new Error("Coberturas de origem sobrepostas exigem conferência.");
  }
  const novasDatas = new Map<string, string>();
  if (dados.vencimentos.opcao === "REPROGRAMAR_PARCELAS") {
    for (const p of dados.vencimentos.datas) {
      if (!ids.includes(p.cobrancaId) || novasDatas.has(p.cobrancaId)) throw new Error("Vencimentos fora da seleção ou repetidos.");
      novasDatas.set(p.cobrancaId, p.vencimento);
    }
    if (novasDatas.size !== ids.length) throw new Error("Informe o vencimento de cada cobrança selecionada.");
  }
  const mantidos = [...dados.mantidos].sort((a, b) => a.inicio.localeCompare(b.inicio));
  for (let i = 1; i < mantidos.length; i++) {
    if (sobrepoe(mantidos[i - 1], mantidos[i])) throw new Error("Coberturas mantidas sobrepostas exigem conferência.");
  }
  let inicio = dados.retorno;
  // Se o retorno ocorre no período já preservado, não emitir outra cobertura sobre ele.
  for (const p of mantidos) if (p.inicio <= inicio && inicio <= p.fim) inicio = seguinte(p.fim);
  return ordenados.map((p) => {
    const limite = periodoMensalNaData(dados.regra, inicio);
    const cobertura = { inicio, fim: limite.fim };
    if (mantidos.some((m) => sobrepoe(m, cobertura))) throw new Error("A nova cobertura conflita com período mantido. Confira a proposta.");
    inicio = seguinte(cobertura.fim);
    return {
      cobrancaId: p.cobrancaId, coberturaAnterior: p.cobertura, cobertura,
      vencimentoAnterior: p.vencimento, vencimento: novasDatas.get(p.cobrancaId) ?? p.vencimento,
    };
  });
}
