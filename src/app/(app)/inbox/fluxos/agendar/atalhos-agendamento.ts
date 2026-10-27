import {atalhosDeHorario} from "@/lib/atalhos-horario";
import {FusoInstitucionalSchema} from "@/server/operacao/fuso";
import {instanteDoCampoLocal,valorCampoLocal} from "@/server/operacao/fuso-entrada";
export type IdAtalhoAgendamento="1h"|"hoje18"|"amanha9"|"amanha14"|"seg9";
export type AtalhoAgendamento={id:IdAtalhoAgendamento;rotulo:string;valorLocal:string};
export function atalhosDeAgendamento(agora:Date,fuso:string):AtalhoAgendamento[]{
 if(!Number.isFinite(agora.getTime())||!FusoInstitucionalSchema.safeParse(fuso).success)return [];
 const base=atalhosDeHorario(agora,fuso),instante=new Date(Math.floor((agora.getTime()+3600000)/60000)*60000);
 const valorLocal=valorCampoLocal(instante,fuso),r=instanteDoCampoLocal(valorLocal,fuso);
 if(!r.ok||r.instante.getTime()!==instante.getTime()||r.instante.getTime()<=agora.getTime())return base;
 return [{id:"1h",rotulo:"Em 1 hora",valorLocal},...base];
}