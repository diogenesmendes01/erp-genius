import {NascimentoCivilSchema} from "./nascimento-civil";
import {DataCivilSchema} from "@/server/matricula/cobertura";
import {dataCivilInstitucional} from "@/server/operacao/fuso";
/** Anos completos por comparação civil.29/02 completa no01/03 em anos não bissextos. */
export function idadeCivil(nascimento:string|null|undefined,hoje:string):number|null{
 if(!nascimento||!NascimentoCivilSchema.safeParse(nascimento).success||!DataCivilSchema.safeParse(hoje).success||nascimento>hoje)return null;
 return Number(hoje.slice(0,4))-Number(nascimento.slice(0,4))-(hoje.slice(5)<nascimento.slice(5)?1:0);
}
/** O relógio é recebido explicitamente; ausência de fuso não usa host/browser como fallback. */
export function idadeCivilInstitucional(nascimento:string|null|undefined,agora:Date,fuso:string|null):number|null{
 if(!fuso)return null;
 try{return idadeCivil(nascimento,dataCivilInstitucional(agora,fuso));}catch{return null;}
}