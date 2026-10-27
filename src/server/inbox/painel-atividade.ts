import {carregarAriaAtividade,type AlteracaoAriaPainel,type AriaNoContato} from "./painel-atividade-aria";
import {Papel} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import type {UsuarioSessao} from "@/server/_shared/sessao";
import {atendimentoVisivel} from "@/server/whatsapp/atendimentos";
import {escopoAtendimentos} from "@/server/whatsapp/escopo";
import {notasInternasDoAtendimento} from "@/server/whatsapp/notas-consulta";
import type {NotaInternaThread} from "@/server/whatsapp/consultas-inbox";
import {carregarTarefasDoAtendimento} from "./painel-tarefas";
import {autorDaAgendada,podeCancelarAgendadaInbox,type ContextoCancelarAgendadaInbox,type AutorAgendada} from "./atividade-regras";
export type AgendadaAtividade={id:string;texto:string;agendadaPara:string;autor:AutorAgendada;podeCancelar:boolean};
export type AtividadeRecente={ultimaInteracaoEm:string|null;conversas:number;tarefasAbertas:number;notas:NotaInternaThread[]};
export type AtividadePainel={agendadas:AgendadaAtividade[];recente:AtividadeRecente;aria:AriaNoContato|null;alteracoes:AlteracaoAriaPainel[]};
export async function carregarAtividadePainel(u:UsuarioSessao,atendimentoId:string):Promise<AtividadePainel|null>{
 if(!u?.id)return null;
 const contextoGP=u.papeis.includes(Papel.GERENTE_PEDAGOGICO);
 const a=await atendimentoVisivel(u,atendimentoId);
 if(!a)return null;
 const listarAgendadas=()=>prisma.intencaoMensagem.findMany({where:{atendimentoId:a.id,agendadaPara:{not:null},passo:null,passoComercial:null,status:{in:["PENDENTE","ADIADA"]}},orderBy:[{agendadaPara:"asc"},{id:"asc"}],select:{id:true,corpoRenderizado:true,agendadaPara:true,autorId:true,origem:true,status:true,passo:true,passoComercial:true,autor:{select:{nome:true}}}});
 const [agendadas,conversas,tarefas,notas,aria]=await Promise.all([
  listarAgendadas(),
  prisma.atendimentoWhatsApp.count({where:{AND:[{conversa:{contatoId:a.contatoId}},await escopoAtendimentos(u)]}}),
  carregarTarefasDoAtendimento(u,a,{soDaConversa:false}),
  notasInternasDoAtendimento(a.id),
  carregarAriaAtividade(u,a.id),
 ]);
  let linhas=agendadas,publicador=u;let contexto:ContextoCancelarAgendadaInbox|undefined;
 if(contextoGP){
  const lerAtor=()=>prisma.usuario.findUnique({where:{id:u.id},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true}});
  const atual=await lerAtor();if(!atual?.ativo)return null;
  if(!await atendimentoVisivel(atual,atendimentoId,false,prisma))return null;
  linhas=await listarAgendadas();
  const ultimo=await lerAtor();if(!ultimo?.ativo||JSON.stringify([atual.papeis,atual.permissoes])!==JSON.stringify([ultimo.papeis,ultimo.permissoes]))return null;
  const final=await atendimentoVisivel(ultimo,atendimentoId,false,prisma);if(!final)return null;
  publicador=ultimo;contexto={ativo:ultimo.ativo,responsavelId:final.responsavelId};
 }
 return {aria:aria.aria,alteracoes:aria.alteracoes,agendadas:linhas.map(m=>({id:m.id,texto:m.corpoRenderizado,agendadaPara:m.agendadaPara!.toISOString(),autor:autorDaAgendada(u.id,{autorId:m.autorId,origem:m.origem,autorNome:m.autor?.nome??null}),podeCancelar:podeCancelarAgendadaInbox(publicador,m,contexto)})),recente:{ultimaInteracaoEm:a.ultimaMensagemEm?.toISOString()??null,conversas,tarefasAbertas:tarefas.filter(t=>t.status==="ABERTA").length,notas:notas.slice(0,2)}};
}