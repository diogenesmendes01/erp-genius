import type {Usuario} from "@prisma/client";
import type {Db} from "@/server/whatsapp/escopo";
import {ErroPermissao,apenasPortal,type UsuarioSessao} from "@/server/_shared/sessao";
import {capacidadesCrm} from "./permissoes";
import {candidatoPodeLerTarefaD10,type TarefaParaCandidatoD10} from "./tarefa-notificados-regras";

export async function listarCandidatosNotificadosTarefaD10(db:Db,autor:UsuarioSessao,tarefa:TarefaParaCandidatoD10):Promise<{id:string;nome:string}[]>{
 const ids=new Set<string>();let cursor:string|undefined;
 for(;;){
  const lote=await db.usuario.findMany({where:{ativo:true},orderBy:{id:"asc"},take:100,...(cursor?{cursor:{id:cursor},skip:1}:{})});
  for(const u of lote)if(candidatoPodeLerTarefaD10(u,tarefa))ids.add(u.id);
  if(lote.length<100)break;
  cursor=lote[lote.length-1]!.id;
 }
 const atual=await db.usuario.findUnique({where:{id:autor.id}});
 if(!atual?.ativo||apenasPortal(atual)||!capacidadesCrm(atual.papeis).has("tarefas.ver"))throw new ErroPermissao();
 const conferir=[...new Set([...ids,autor.id,...(tarefa.responsavelId?[tarefa.responsavelId]:[])])];
 const finais:Usuario[]=[];
 for(let i=0;i<conferir.length;i+=100)finais.push(...await db.usuario.findMany({where:{id:{in:conferir.slice(i,i+100)}}}));
 const ultima=await db.usuario.findUnique({where:{id:autor.id}});
 if(!ultima?.ativo||apenasPortal(ultima)||!capacidadesCrm(ultima.papeis).has("tarefas.ver"))throw new ErroPermissao();
 const dono=tarefa.responsavelId?finais.find(u=>u.id===tarefa.responsavelId):null;
 const alvo={...tarefa,gerenteDoResponsavelId:dono?.gerenteComercialId??null};
 const fresco=ultima;
 if(!fresco||!candidatoPodeLerTarefaD10(fresco,alvo))throw new ErroPermissao();
 return finais.filter(u=>ids.has(u.id)&&candidatoPodeLerTarefaD10(u,alvo)).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR")||a.id.localeCompare(b.id)).map(u=>({id:u.id,nome:u.nome}));
}