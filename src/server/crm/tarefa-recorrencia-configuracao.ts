import { ErroRegra } from "@/server/_shared/sessao";
import { DataCivilSchema } from "@/server/matricula/cobertura";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { z } from "zod";
import type { RecorrenciaTarefa } from "@prisma/client";
export const RecorrenciaTarefaSchema = z.enum(["NAO_REPETE", "DIARIA", "SEMANAL", "MENSAL"]);
export type AncoraConfiguradaTarefa = { recorrencia: RecorrenciaTarefa; recorrenciaAncoraDataCivil: string|null; recorrenciaAncoraHora: string|null; recorrenciaAncoraFuso: string|null; recorrenciaPoliticaVersao: number|null; recorrenciaIndice: number };
export function configurarRecorrenciaTarefa(pedido: RecorrenciaTarefa|undefined, agenda: {dataCivil:string|null;hora:string|null;fusoOrigem:string}, atual?: AncoraConfiguradaTarefa): Partial<AncoraConfiguradaTarefa> {
  if(pedido===undefined&&!atual)return {};
  const r=RecorrenciaTarefaSchema.safeParse(pedido??atual?.recorrencia);
  if(!r.success)throw new ErroRegra("Recorrência inválida.");
  if(r.data==="NAO_REPETE")return pedido===undefined?{}:{recorrencia:r.data,recorrenciaAncoraDataCivil:null,recorrenciaAncoraHora:null,recorrenciaAncoraFuso:null,recorrenciaPoliticaVersao:null,recorrenciaIndice:0};
  if(!agenda.dataCivil)throw new ErroRegra("A recorrência exige uma data.");
  if(!DataCivilSchema.safeParse(agenda.dataCivil).success||!FusoInstitucionalSchema.safeParse(agenda.fusoOrigem).success||agenda.hora!==null&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(agenda.hora))throw new ErroRegra("Data, horário ou fuso da recorrência inválido.");
  if(atual&&r.data===atual.recorrencia)return {};
  return {recorrencia:r.data,recorrenciaAncoraDataCivil:agenda.dataCivil,recorrenciaAncoraHora:agenda.hora,recorrenciaAncoraFuso:agenda.fusoOrigem,recorrenciaPoliticaVersao:1,recorrenciaIndice:0};
}