import type { Prisma, PrioridadeTarefa, StatusTarefa, TipoTarefa } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import type { Db } from "@/server/whatsapp/escopo";
import { capacidadesCrm } from "@/server/crm/permissoes";
import { escopoTarefas } from "@/server/crm/tarefas";
import { grupoDaTarefa } from "@/server/crm/tarefas-regras";
import { valorCampoLocal } from "@/server/operacao/fuso-entrada";
import type { MensagemAgendadaDaTarefa } from "@/lib/selo-mensagem-agendada";
import { carregarMensagensAgendadasDasTarefas } from "./mensagem-agendada-tarefa";
export type TarefaPainel = {
 id:string;versao:number;titulo:string;descricao:string|null;tipo:TipoTarefa;status:StatusTarefa;prioridade:PrioridadeTarefa;
 dataCivil:string|null;hora:string|null;fusoOrigem:string;lembreteAntecedenciaMin:number|null;
 responsavel:{id:string;nome:string}|null;atrasada:boolean;ia:boolean;leadId:string|null;atendimentoId:string|null;
 criadoEm:string;criadorNome:string|null;podeAgir:boolean;mensagemAgendada?:MensagemAgendadaDaTarefa|null;
};
const select={id:true,versao:true,titulo:true,descricao:true,tipo:true,status:true,prioridade:true,dataCivil:true,inicioEm:true,fusoOrigem:true,lembreteAntecedenciaMin:true,responsavel:{select:{id:true,nome:true}},origem:true,leadId:true,atendimentoId:true,criadoEm:true,criador:{select:{nome:true}}} satisfies Prisma.TarefaSelect;
export async function carregarTarefasDoAtendimento(u:UsuarioSessao,a:{id:string;leadId:string|null},o:{soDaConversa:boolean;agora?:Date},db:Db=prisma):Promise<TarefaPainel[]>{
 const cap=capacidadesCrm(u.papeis);if(!u.id||!cap.has("tarefas.ver"))return [];
 const pertence:Prisma.TarefaWhereInput=o.soDaConversa?{atendimentoId:a.id}:{OR:[{atendimentoId:a.id},...(a.leadId?[{leadId:a.leadId}]:[])]};
 const where:Prisma.TarefaWhereInput={AND:[await escopoTarefas(u,cap.has("tarefas.equipe")),pertence]};
 const tarefas=o.soDaConversa?await db.tarefa.findMany({where,select,orderBy:[{criadoEm:"asc"},{id:"asc"}]}):[
  ...await db.tarefa.findMany({where:{AND:[where,{status:"ABERTA"}]},select,orderBy:[{dataCivil:{sort:"asc",nulls:"last"}},{inicioEm:{sort:"asc",nulls:"last"}},{id:"asc"}]}),
  ...await db.tarefa.findMany({where:{AND:[where,{status:"CONCLUIDA"}]},select,orderBy:[{concluidaEm:{sort:"desc",nulls:"last"}},{id:"desc"}],take:5}),
 ];
 const agora=o.agora??new Date();
 const mensagens=await carregarMensagensAgendadasDasTarefas(db,tarefas.map(t=>({id:t.id,fusoOrigem:t.fusoOrigem})));
 return tarefas.map(t=>({id:t.id,versao:t.versao,titulo:t.titulo,descricao:t.descricao,tipo:t.tipo,status:t.status,prioridade:t.prioridade,dataCivil:t.dataCivil,hora:t.inicioEm?valorCampoLocal(t.inicioEm,t.fusoOrigem).slice(11,16):null,fusoOrigem:t.fusoOrigem,lembreteAntecedenciaMin:t.lembreteAntecedenciaMin,responsavel:t.responsavel,atrasada:grupoDaTarefa(t,agora,t.fusoOrigem)==="ATRASADAS",ia:t.origem==="IA"||t.origem==="IA_SUGERIDA",leadId:t.leadId,atendimentoId:t.atendimentoId,criadoEm:t.criadoEm.toISOString(),criadorNome:t.criador?.nome??null,podeAgir:t.status==="ABERTA",mensagemAgendada:mensagens.get(t.id)??null}));
}