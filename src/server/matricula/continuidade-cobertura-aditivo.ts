import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
const Data=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Entrada=z.object({ vigenciaInicio:Data, status:z.literal("COMPLETO"), escolha:z.enum(["PRESERVAR_REFERENCIA","MUDAR_REFERENCIA"]), ciclo:z.unknown(), prova:z.boolean() });
/** Preservar não restaura o contrato original: mantém a última âncora já vigente. */
export function selecionarPoliticaCoberturaAditivo(entradas: unknown[], inicioSeguinte: string) {
 let ultima: z.infer<typeof Entrada> | null=null;
 for(const x of entradas.map(x=>Entrada.parse(x)).sort((a,b)=>a.vigenciaInicio.localeCompare(b.vigenciaInicio))) {
   if(x.vigenciaInicio>inicioSeguinte) break;
   if(!x.prova) throw new ErroRegra("Conjunto de cobertura completo sem prova íntegra.");
   if(x.escolha==="MUDAR_REFERENCIA") ultima=x;
 }
 return ultima ? z.object({ referencia:z.enum(["MES_CIVIL","CICLO_MATRICULA"]), dataReferencia:Data }).parse(ultima.ciclo) : null;
}
