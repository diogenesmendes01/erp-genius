import {somarDiasDataCivil} from "@/server/crm/tarefas-regras";
import {valorCampoLocal} from "@/server/operacao/fuso-entrada";
export function quandoAgendada(iso:string,fuso:string,agora:Date):string{
 const local=valorCampoLocal(iso,fuso),hoje=valorCampoLocal(agora,fuso).slice(0,10);if(!local)return iso;
 const dia=local.slice(0,10),hora=local.slice(11,16);
 if(hoje&&dia===hoje)return `Hoje às ${hora}`;
 if(hoje&&dia===somarDiasDataCivil(hoje,1))return `Amanhã às ${hora}`;
 return `${dia.slice(8,10)}/${dia.slice(5,7)} às ${hora}`;
}
