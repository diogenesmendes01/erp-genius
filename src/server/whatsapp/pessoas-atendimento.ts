import {prisma} from "@/lib/prisma";
import type {UsuarioSessao} from "@/server/_shared";
import {podeExecutar} from "@/server/inbox/permissoes";
import {atendimentoVisivel} from "./atendimentos";
import {PAPEIS_INBOX,type Db} from "./escopo";
import {papeisDoSetor} from "./setor";
export async function contextoPessoas(u:UsuarioSessao,id:string,para:"atribuir"|"convidar",db:Db=prisma){
  const a=await atendimentoVisivel(u,id,false,db);
  if(!a||a.encerradoEm)return null;
  if(!podeExecutar(u,para,{setor:a.finalidade,responsavelId:a.responsavelId}))return null;
  const papeis=para==="atribuir"?papeisDoSetor(a.finalidade):PAPEIS_INBOX;
  const pessoas=await db.usuario.findMany({
    where:{ativo:true,id:{not:u.id},papeis:{hasSome:papeis}},
    select:{id:true,nome:true},orderBy:{nome:"asc"},take:200,
  });
  return{a,pessoas};
}
