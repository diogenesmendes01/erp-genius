import {Papel,type IntencaoMensagem,type OrigemEnvio} from "@prisma/client";
import type {UsuarioSessao} from "@/server/_shared/sessao";
import {capacidadesCrm} from "@/server/crm/permissoes";
export type AutorAgendada={tipo:"voce"}|{tipo:"aria"}|{tipo:"pessoa";nome:string};
export type AgendadaParaCancelamento=Pick<IntencaoMensagem,"autorId"|"origem"|"status"|"agendadaPara"|"passo"|"passoComercial">;
export function autorDaAgendada(usuarioId:string,m:{autorId:string|null;origem:OrigemEnvio;autorNome:string|null}):AutorAgendada{
 if(m.origem==="IA")return {tipo:"aria"};
 if(m.autorId===usuarioId)return {tipo:"voce"};
 return {tipo:"pessoa",nome:m.autorNome?.trim()||"Sistema"};
}
export type ContextoCancelarAgendadaInbox={ativo:boolean;responsavelId:string|null};
export function podeGerirAgendadaInbox(u:Pick<UsuarioSessao,"id"|"papeis">,m:AgendadaParaCancelamento,contexto?:ContextoCancelarAgendadaInbox):boolean{
 if(!u.id||!m.agendadaPara||m.passo!==null||m.passoComercial!==null)return false;
 if(!capacidadesCrm(u.papeis).has("tarefas.ver"))return u.papeis.includes(Papel.GERENTE_PEDAGOGICO)&&contexto?.ativo===true&&contexto.responsavelId===u.id&&m.origem==="HUMANO"&&m.autorId===u.id;
 const admin=u.papeis.includes(Papel.ADMINISTRADOR);
 return m.origem==="IA"?admin:admin||m.autorId===u.id;
}
export function podeCancelarAgendadaInbox(u:Pick<UsuarioSessao,"id"|"papeis">,m:AgendadaParaCancelamento,contexto?:ContextoCancelarAgendadaInbox):boolean{
 return (m.status==="PENDENTE"||m.status==="ADIADA")&&podeGerirAgendadaInbox(u,m,contexto);
}