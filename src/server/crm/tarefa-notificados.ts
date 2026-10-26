import {Prisma} from "@prisma/client";
import {ErroRegra,ErroPermissao,apenasPortal,type UsuarioSessao} from "@/server/_shared/sessao";
import {capacidadesCrm} from "./permissoes";
import {candidatoPodeLerTarefaD10,type TarefaParaCandidatoD10} from "./tarefa-notificados-regras";
import {CamposAdicionaisTarefaD10Schema} from "./tarefa-d10-schema";

/** IDs ordenados e NOWAIT: nunca esperar Usuario depois de Task para adquirir a nova FK. */
export async function validarNotificadosTarefaD10(tx:Prisma.TransactionClient,autor:UsuarioSessao,tarefa:TarefaParaCandidatoD10,pedido:readonly string[]):Promise<{ids:string[];autor:UsuarioSessao}>{
 const ids=CamposAdicionaisTarefaD10Schema.parse({notificarUsuarioIds:[...pedido]}).notificarUsuarioIds!;
 const travar=[...new Set([autor.id,...ids,...(tarefa.responsavelId?[tarefa.responsavelId]:[])])].sort();
 await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id IN (${Prisma.join(travar)}) ORDER BY id FOR KEY SHARE NOWAIT`;
 const atual=await tx.usuario.findUnique({where:{id:autor.id}});
 if(!atual?.ativo||apenasPortal(atual)||!capacidadesCrm(atual.papeis).has("tarefas.ver"))throw new ErroPermissao();
 const lote=await tx.usuario.findMany({where:{id:{in:travar}}});
 // KEY SHARE não congela papéis. O lote final revalida autor, responsável e destinatários.
 const finais=await tx.usuario.findMany({where:{id:{in:travar}}});
 const final=finais.find(u=>u.id===autor.id),dono=tarefa.responsavelId?finais.find(u=>u.id===tarefa.responsavelId):null;
 const alvo={...tarefa,gerenteDoResponsavelId:dono?.gerenteComercialId??null};
 if(!final?.ativo||apenasPortal(final)||!candidatoPodeLerTarefaD10(final,alvo))throw new ErroPermissao();
 const membros=finais.filter(u=>ids.includes(u.id));
 if(tarefa.responsavelId&&!dono||lote.length!==finais.length||membros.length!==ids.length||membros.some(u=>!candidatoPodeLerTarefaD10(u,alvo)))throw new ErroRegra("Um colega selecionado não tem autorização para esta tarefa. Atualize a seleção.");
 return {ids,autor:final};
}

/** Não incrementa Task/rearma lembrete; CAS e auditoria continuam no writer chamador. */
export async function gravarNotificadosTarefaD10(tx:Prisma.TransactionClient,tarefaId:string,antes:readonly string[],depois:readonly string[]):Promise<boolean>{
 const a=[...new Set(antes)].sort(),d=[...new Set(depois)].sort();
 if(a.length===d.length&&a.every((id,i)=>id===d[i]))return false;
 await tx.tarefaNotificado.deleteMany({where:{tarefaId}});
 if(d.length)await tx.tarefaNotificado.createMany({data:d.map(usuarioId=>({tarefaId,usuarioId}))});
 return true;
}

/** Aplicar somente fora da transação já abortada; os demais erros conservam seu diagnóstico. */
export function erroContencaoNotificadosTarefaD10(erro:unknown):never{
 if(typeof erro==="object"&&erro!==null){
  const e=erro as {code?:unknown;meta?:{code?:unknown}};
  if(e.code==="55P03"||e.meta?.code==="55P03")throw new ErroRegra("Um colega está sendo atualizado. Recarregue e tente novamente.");
 }
 throw erro;
}