import {Papel,type OrigemEnvio,type StatusIntencao} from "@prisma/client";
import {apenasPortal,type UsuarioSessao} from "@/server/_shared/sessao";
import {capacidadesCrm} from "@/server/crm/permissoes";
import type {EstadoAria} from "./estado-aria-valores";
export type AtorAgendadaInbox=UsuarioSessao & {ativo:boolean};
export type AlvoAgendadaInbox={atendimentoId:string|null;origem:OrigemEnvio;autorId:string|null;autorGerenteComercialId:string|null;status:StatusIntencao;agendadaPara:Date|null;passo:string|null;passoComercial:string|null};
export type ContextoAlterarAgendada={id:string;responsavelId:string|null;encerradoEm:Date|null;autorizadoEnviar:boolean;estadoAria:EstadoAria|null;numeroAtivo:boolean;optOut:boolean};
export function podeAlterarAgendadaNoInbox(u:AtorAgendadaInbox,m:AlvoAgendadaInbox,c:ContextoAlterarAgendada):boolean{
 if(!u.id||!u.ativo||apenasPortal(u)||c.encerradoEm||!c.autorizadoEnviar||!c.numeroAtivo||c.optOut)return false;
 if(c.responsavelId!==u.id||c.estadoAria==="ia"||c.estadoAria==="aprovacao"||c.estadoAria==="handoff")return false;
 if(m.atendimentoId!==c.id||m.origem!=="HUMANO"||!m.agendadaPara||m.passo!==null||m.passoComercial!==null)return false;
 if(m.status!=="PENDENTE"&&m.status!=="ADIADA")return false;
 return m.autorId===u.id||u.papeis.includes(Papel.ADMINISTRADOR)||
  (capacidadesCrm(u.papeis).has("tarefas.equipe")&&m.autorGerenteComercialId===u.id);
}
