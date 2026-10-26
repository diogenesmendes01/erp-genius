import type {Prisma} from "@prisma/client";
import type {Db} from "@/server/whatsapp/escopo";
import {escopoAtendimentos} from "@/server/whatsapp/escopo";
import {apenasPortal,type UsuarioSessao} from "@/server/_shared/sessao";
import {escopoTarefas} from "./tarefas";
import {capacidadesCrm} from "./permissoes";
import type {NotificacaoItem} from "./notificacoes";

const MAX_CONFERENCIAS_PERFIL=3;
const SELECT={id:true,tipo:true,titulo:true,refTipo:true,refId:true,criadaEm:true,lidaEm:true} satisfies Prisma.NotificacaoUsuarioSelect;
type Linha=Prisma.NotificacaoUsuarioGetPayload<{select:typeof SELECT}>;
const perfil=(u:UsuarioSessao)=>JSON.stringify([[...u.papeis].sort(),[...(u.permissoes??[])].sort()]);
async function atorAtual(db:Db,id:string){
 const u=await db.usuario.findUnique({where:{id},select:{id:true,nome:true,ativo:true,papeis:true,permissoes:true}});
 return u?.ativo&&!apenasPortal(u)?u:null;
}
/** Cada passe relê ator e alçadas sem memo global. Perfil alterado durante awaits exige nova conferência. */
async function conferir(db:Db,usuarioId:string,linhas:Linha[]):Promise<Linha[]|null>{
 let u=await atorAtual(db,usuarioId);
 for(let tentativa=0;tentativa<MAX_CONFERENCIAS_PERFIL;tentativa++){
  if(!u)return null;
  const idsMencoes=[...new Set(linhas.filter(n=>n.tipo==='MENCAO_NOTA'&&n.refTipo==='AtendimentoWhatsApp').map(n=>n.refId))];
  const idsTarefas=[...new Set(linhas.filter(n=>n.tipo==='LEMBRETE_TAREFA'&&n.refTipo==='Tarefa').map(n=>n.refId))];
  const mencoes=new Set<string>(),tarefas=new Set<string>();
  if(idsMencoes.length){
   const escopo=await escopoAtendimentos(u,{db});
   for(let i=0;i<idsMencoes.length;i+=100){
    const rows=await db.atendimentoWhatsApp.findMany({where:{AND:[{id:{in:idsMencoes.slice(i,i+100)}},escopo,{conversa:{contatoId:{not:null},grupoId:null}}]},select:{id:true}});
    rows.forEach(r=>mencoes.add(r.id));
   }
  }
  const capacidades=capacidadesCrm(u.papeis);
  if(idsTarefas.length&&capacidades.has('tarefas.ver')){
   const escopo=await escopoTarefas(u,capacidades.has('tarefas.equipe'));
   for(let i=0;i<idsTarefas.length;i+=100){
    const rows=await db.tarefa.findMany({where:{AND:[{id:{in:idsTarefas.slice(i,i+100)}},escopo]},select:{id:true}});
    rows.forEach(r=>tarefas.add(r.id));
   }
  }
  const fresco=await atorAtual(db,usuarioId);
  if(!fresco)return null;
  if(perfil(fresco)!==perfil(u)){u=fresco;continue;}
  return linhas.filter(n=>n.tipo==='MENCAO_NOTA'?n.refTipo==='AtendimentoWhatsApp'&&mencoes.has(n.refId):n.tipo==='LEMBRETE_TAREFA'?n.refTipo==='Tarefa'&&tarefas.has(n.refId):true);
 }
 // Perfil oscilante não autoriza publicar o último snapshot positivo.
 return null;
}
const serializar=(linhas:Linha[]):NotificacaoItem[]=>linhas.slice(0,20).map(n=>({id:n.id,tipo:n.tipo,titulo:n.titulo,refTipo:n.refTipo,refId:n.refId,criadaEm:n.criadaEm,lida:n.lidaEm!==null}));
/** ReadCommitted: conferência final depois de cada lote, sem prometer linearizabilidade após a última consulta. */
export async function lerNotificacoesNaDb(db:Db,usuarioId:string):Promise<NotificacaoItem[]>{
 if(!await atorAtual(db,usuarioId))return[];
 let candidatas:Linha[]=[],cursor:{criadaEm:Date;id:string}|undefined;
 for(;;){
  const linhas=await db.notificacaoUsuario.findMany({where:{usuarioId,...(cursor?{OR:[{criadaEm:{lt:cursor.criadaEm}},{criadaEm:cursor.criadaEm,id:{lt:cursor.id}}]}:{})},orderBy:[{criadaEm:'desc'},{id:'desc'}],take:100,select:SELECT});
  if(!linhas.length&&!candidatas.length)return[];
  // No máximo 19 candidatas anteriores +100 linhas SQL; nenhuma cauda válida é descartada antes da conferência final.
  const lote=await conferir(db,usuarioId,[...candidatas,...linhas]);
  if(lote===null)return[];
  const finais=await conferir(db,usuarioId,lote);
  if(finais===null)return[];
  candidatas=finais;
  if(candidatas.length>=20||linhas.length<100)return serializar(candidatas);
  const ultima=linhas[linhas.length-1];
  cursor={criadaEm:ultima.criadaEm,id:ultima.id};
 }
}