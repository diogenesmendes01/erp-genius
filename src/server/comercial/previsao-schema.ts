import { z } from "zod";
import { DataCivilSchema } from "@/server/matricula/cobertura";

const mensagemPercentual="Informe um percentual inteiro entre 0 e 100.";
const percentual=z.preprocess(v=>{
  if(typeof v!=="string")return v;
  const texto=v.trim();
  if(texto==="")return null;
  return /^\d+$/.test(texto)?Number(texto):NaN;
},z.number({invalid_type_error:mensagemPercentual}).finite(mensagemPercentual).int(mensagemPercentual).min(0,mensagemPercentual).max(100,mensagemPercentual).nullable()).optional();
const diaCivil=z.preprocess(v=>typeof v==="string"?(v.trim()===""?null:v.trim()):v,DataCivilSchema.nullable()).optional();

/** Patch de previsão manual; omissão preserva e null limpa, sem tratar estimativa de IA como dado manual. */
export const PrevisaoOportunidadeSchema=z.object({probabilidadePct:percentual,previsaoFechamento:diaCivil}).strict("Dados de previsão inválidos.");
export type PrevisaoOportunidadeInput=z.input<typeof PrevisaoOportunidadeSchema>;
export type ValoresPrevisao={probabilidadePct:number|null;previsaoFechamento:string|null};
type MudancasPrevisao={probabilidadePct?:{de:number|null;para:number|null};previsaoFechamento?:{de:string|null;para:string|null}};
/** Projeção pura compartilhável pelos writers; não cria entidade, Evento ou defaults. */
export function prepararMudancaPrevisao(atual:ValoresPrevisao,entrada:unknown){
  const d=PrevisaoOportunidadeSchema.parse(entrada),dados:Partial<ValoresPrevisao>={},mudancas:MudancasPrevisao={};
  if(d.probabilidadePct!==undefined&&d.probabilidadePct!==atual.probabilidadePct){dados.probabilidadePct=d.probabilidadePct;mudancas.probabilidadePct={de:atual.probabilidadePct,para:d.probabilidadePct};}
  if(d.previsaoFechamento!==undefined&&d.previsaoFechamento!==atual.previsaoFechamento){dados.previsaoFechamento=d.previsaoFechamento;mudancas.previsaoFechamento={de:atual.previsaoFechamento,para:d.previsaoFechamento};}
  return {dados,mudancas,alterado:Object.keys(dados).length>0};
}
