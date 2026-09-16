import { z } from "zod";
import { DataCivilSchema } from "@/server/matricula/cobertura";
import { OrigemCampoSchema } from "./campos";
import { ValorAlteracaoAditivoSchema, validarValorAlteracaoAditivo } from "./aditivo-valores";

const MoedaSchema = z.string().regex(/^[A-Z]{3}$/);
const FonteMonetariaSchema = z.enum(["TAXA_VALOR", "MENSALIDADE_VALOR", "HORA_VALOR", "ADIANTAMENTO_VALOR"]);
export const ContextoCoerenciaValoresAditivoSchema = z.object({
  moeda: MoedaSchema,
  coberturaInicio: DataCivilSchema.nullable(),
  coberturaFim: DataCivilSchema.nullable(),
  fontesMonetarias: z.array(FonteMonetariaSchema).max(4).refine(xs => new Set(xs).size === xs.length, "Fontes monetárias repetidas."),
}).strict();
export const AlteracaoTipadaAditivoSchema = z.object({ origem: OrigemCampoSchema, valorEstruturado: ValorAlteracaoAditivoSchema }).strict();
const EntradaSchema = z.object({ origem: ContextoCoerenciaValoresAditivoSchema, alteracoes: z.array(AlteracaoTipadaAditivoSchema).max(100) }).strict();

/** Confere relações entre valores tipados e fatos da origem; não aplica as condições. */
export function validarCoerenciaValoresAditivo(entrada: unknown): void {
  const d = EntradaSchema.parse(entrada);
  if (new Set(d.alteracoes.map(a => a.origem)).size !== d.alteracoes.length) throw new Error("Alteração tipada repetida.");
  for (const alteracao of d.alteracoes) validarValorAlteracaoAditivo(alteracao.origem, alteracao.valorEstruturado);

  const inicioAlterado = d.alteracoes.find(a => a.origem === "COBERTURA_INICIO")?.valorEstruturado;
  const fimAlterado = d.alteracoes.find(a => a.origem === "COBERTURA_FIM")?.valorEstruturado;
  const inicio = inicioAlterado?.tipo === "DATA" ? inicioAlterado.data : d.origem.coberturaInicio;
  const fim = fimAlterado?.tipo === "DATA" ? fimAlterado.data : d.origem.coberturaFim;
  if (inicioAlterado || fimAlterado) {
    if (inicio === null || fim === null) throw new Error("Resolva início e fim da cobertura antes de alterar o período.");
    if (inicio > fim) throw new Error("O início da cobertura não pode ser posterior ao fim.");
  }

  const moedaAlterada = d.alteracoes.find(a => a.origem === "MOEDA")?.valorEstruturado;
  const moedaNova = moedaAlterada?.tipo === "MOEDA" ? moedaAlterada.moeda : null;
  const monetarias = d.alteracoes.filter(a => FonteMonetariaSchema.safeParse(a.origem).success);
  if (monetarias.some(a => a.valorEstruturado.tipo !== "DINHEIRO")) throw new Error("Cada condição monetária exige valor estruturado em dinheiro.");
  if (moedaNova) {
    const presentes = new Set(monetarias.map(a => a.origem));
    if (d.origem.fontesMonetarias.some(fonte => !presentes.has(fonte))) throw new Error("A nova moeda exige decidir todas as condições monetárias existentes.");
    if (monetarias.some(a => a.valorEstruturado.tipo === "DINHEIRO" && a.valorEstruturado.moeda !== moedaNova)) throw new Error("Todos os valores monetários precisam usar a nova moeda proposta.");
  } else if (monetarias.some(a => a.valorEstruturado.tipo === "DINHEIRO" && a.valorEstruturado.moeda !== d.origem.moeda)) {
    throw new Error("O valor monetário precisa usar a moeda contratual ou propor uma nova moeda explicitamente.");
  }
}
