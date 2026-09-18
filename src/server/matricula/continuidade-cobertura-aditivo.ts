import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { DataCivilSchema, RegraCoberturaSchema } from "./cobertura";
const Data = DataCivilSchema;
const Entrada=z.object({ vigenciaInicio:Data, status:z.literal("COMPLETO"), escolha:z.enum(["PRESERVAR_REFERENCIA","MUDAR_REFERENCIA"]), ciclo:z.unknown(), prova:z.boolean() });
/** Preservar não restaura o contrato original: mantém a última âncora já vigente. */
export function selecionarPoliticaCoberturaAditivo(entradas: unknown[], inicioSeguinte: string) {
 Data.parse(inicioSeguinte);
 let ultima: z.infer<typeof Entrada> | null=null;
 const vigencias = new Set<string>();
 for(const x of entradas.map(x=>Entrada.parse(x)).sort((a,b)=>a.vigenciaInicio.localeCompare(b.vigenciaInicio))) {
   if(x.vigenciaInicio>inicioSeguinte) break;
   if (vigencias.has(x.vigenciaInicio)) throw new ErroRegra("Há políticas de cobertura com vigência ambígua; confira a cadeia contratual.");
   vigencias.add(x.vigenciaInicio);
   if(!x.prova) throw new ErroRegra("Conjunto de cobertura completo sem prova íntegra.");
   if(x.escolha==="MUDAR_REFERENCIA") ultima=x;
 }
 if (!ultima) return null;
 const ciclo = z.object({ referencia:z.enum(["MES_CIVIL","CICLO_MATRICULA"]), dataReferencia:Data }).parse(ultima.ciclo);
 // O planejador usa um schema estrito: mês civil não possui âncora individual.
 return RegraCoberturaSchema.parse(ciclo.referencia === "MES_CIVIL" ? { referencia: "MES_CIVIL" } : ciclo);
}
