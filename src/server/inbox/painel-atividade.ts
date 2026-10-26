import {carregarAriaAtividade,type AlteracaoAriaPainel,type AriaNoContato} from "./painel-atividade-aria";
import {prisma} from "@/lib/prisma";
import type {UsuarioSessao} from "@/server/_shared/sessao";
import {atendimentoVisivel} from "@/server/whatsapp/atendimentos";
import {escopoAtendimentos} from "@/server/whatsapp/escopo";
import {notasInternasDoAtendimento} from "@/server/whatsapp/notas-consulta";
import type {NotaInternaThread} from "@/server/whatsapp/consultas-inbox";
import {carregarTarefasDoAtendimento} from "./painel-tarefas";
import {autorDaAgendada,podeCancelarAgendadaInbox,type AutorAgendada} from "./atividade-regras";
export type AgendadaAtividade={id:string;texto:string;agendadaPara:string;autor:AutorAgendada;podeCancelar:boolean};
export type AtividadeRecente={ultimaInteracaoEm:string|null;conversas:number;tarefasAbertas:number;notas:NotaInternaThread[]};
export type AtividadePainel={agendadas:AgendadaAtividade[];recente:AtividadeRecente;aria:AriaNoContato|null;alteracoes:AlteracaoAriaPainel[]};
/** Leitura da conversa, não permissão de envio/Assumir; ações mantêm autorização própria fresca. */
export async function carregarAtividadePainel(u:UsuarioSessao,atendimentoId:string):Promise<AtividadePainel|null>{
 if(!u?.id)return null;
 const a=await atendimentoVisivel(u,atendimentoId);
 if(!a)return null;
 const [agendadas,conversas,tarefas,notas,aria]=await Promise.all([
  prisma.intencaoMensagem.findMany({where:{atendimentoId:a.id,agendadaPara:{not:null},passo:null,passoComercial:null,status:{in:["PENDENTE","ADIADA"]}},orderBy:[{agendadaPara:"asc"},{id:"asc"}],select:{id:true,corpoRenderizado:true,agendadaPara:true,autorId:true,origem:true,status:true,passo:true,passoComercial:true,autor:{select:{nome:true}}}}),
  prisma.atendimentoWhatsApp.count({where:{AND:[{conversa:{contatoId:a.contatoId}},await escopoAtendimentos(u)]}}),
  carregarTarefasDoAtendimento(u,a,{soDaConversa:false}),
  notasInternasDoAtendimento(a.id),
  carregarAriaAtividade(u,a.id),
 ]);
 return {aria:aria.aria,alteracoes:aria.alteracoes,agendadas:agendadas.map(m=>({id:m.id,texto:m.corpoRenderizado,agendadaPara:m.agendadaPara!.toISOString(),autor:autorDaAgendada(u.id,{autorId:m.autorId,origem:m.origem,autorNome:m.autor?.nome??null}),podeCancelar:podeCancelarAgendadaInbox(u,m)})),recente:{ultimaInteracaoEm:a.ultimaMensagemEm?.toISOString()??null,conversas,tarefasAbertas:tarefas.filter(t=>t.status==="ABERTA").length,notas:notas.slice(0,2)}};
}