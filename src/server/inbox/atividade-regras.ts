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
/** Política operacional específica Inbox; não amplia o default HUMANO nem o escopo de equipe CRM. */
export function podeGerirAgendadaInbox(u:Pick<UsuarioSessao,"id"|"papeis">,m:AgendadaParaCancelamento):boolean{
 if(!u.id||!capacidadesCrm(u.papeis).has("tarefas.ver")||!m.agendadaPara||m.passo!==null||m.passoComercial!==null)return false;
 const admin=u.papeis.includes(Papel.ADMINISTRADOR);
 return m.origem==="IA"?admin:admin||m.autorId===u.id;
}
export function podeCancelarAgendadaInbox(u:Pick<UsuarioSessao,"id"|"papeis">,m:AgendadaParaCancelamento):boolean{
 return (m.status==="PENDENTE"||m.status==="ADIADA")&&podeGerirAgendadaInbox(u,m);
}