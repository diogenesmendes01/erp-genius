import type {Prisma} from "@prisma/client";
import {apenasPortal,temPapel,ErroPermissao,ErroAutenticacao} from "@/server/_shared/sessao";
import {PAPEIS_INBOX} from "@/server/whatsapp/escopo";
import {contextoPessoas} from "@/server/whatsapp/pessoas-atendimento";
import {classificarPresencaInbox,type InscricaoPresencaInbox,type StatusPresencaInbox} from "@/lib/presenca-inbox";
import type {ConsultaPresenca} from "./presenca-schema";
export class ErroFotoPresenca extends Error{constructor(){super("Presença indisponível neste contexto.");}}
export type FotoPresenca={tokenModal:string;pessoas:{usuarioId:string;status:StatusPresencaInbox}[];validadeMs:number};
async function fresco(db:Prisma.TransactionClient,id:string){const u=await db.usuario.findUnique({where:{id},select:{id:true,nome:true,ativo:true,papeis:true,permissoes:true}});if(!u?.ativo)throw new ErroAutenticacao();if(apenasPortal(u)||!temPapel(u,...PAPEIS_INBOX))throw new ErroPermissao();return u;}
export async function lerPresencasTransferiveis(db:Prisma.TransactionClient,usuarioId:string,consulta:ConsultaPresenca):Promise<FotoPresenca>{
 const u=await fresco(db,usuarioId),c=await contextoPessoas(u,consulta.atendimentoId,"atribuir",db);
 if(!c||c.a.conversa?.grupoId)throw new ErroFotoPresenca();
 const ids=c.pessoas.map(p=>p.id).filter(id=>id!==u.id&&id!==c.a.responsavelId);
 const rows=ids.length?await db.presencaInbox.findMany({where:{usuarioId:{in:ids},desconectadaEm:null,confirmadaEm:{not:null}}}):[];
 const atual=await fresco(db,usuarioId),final=await contextoPessoas(atual,consulta.atendimentoId,"atribuir",db);
 if(!final||final.a.conversa?.grupoId||final.a.finalidade!==c.a.finalidade)throw new ErroFotoPresenca();
 const [{agora}]=await db.$queryRaw<{agora:Date}[]>`SELECT clock_timestamp()::timestamptz(3) AS agora`;
 const ms=agora.getTime();if(!Number.isFinite(ms))throw new Error("Relógio indisponível.");
 const permitidos=new Set(ids),finais=final.pessoas.map(p=>p.id).filter(id=>permitidos.has(id)&&id!==atual.id&&id!==final.a.responsavelId);
 let validadeMs=25000;
 const pessoas:FotoPresenca["pessoas"]=[];
 for(const id of finais){
  const grupo=rows.filter(r=>r.usuarioId===id);
  if(grupo.some(r=>r.geracao>BigInt(Number.MAX_SAFE_INTEGER)||r.geracao<1n))continue;
  const inscricoes:InscricaoPresencaInbox[]=grupo.map(r=>({id:r.id,geracao:Number(r.geracao),confirmadaEm:r.confirmadaEm?.getTime()??null,ultimoContatoEm:r.ultimoContatoEm.getTime(),ultimaInteracaoEm:r.ultimaInteracaoEm?.getTime()??null,desconectadaEm:r.desconectadaEm?.getTime()??null}));
  pessoas.push({usuarioId:id,status:classificarPresencaInbox(inscricoes,ms)});
  for(const s of inscricoes){
   if(s.desconectadaEm!==null||s.confirmadaEm===null||s.ultimoContatoEm>ms||s.ultimoContatoEm+60000<=ms)continue;
   validadeMs=Math.min(validadeMs,s.ultimoContatoEm+60000-ms);
   if(s.ultimaInteracaoEm!==null&&s.ultimaInteracaoEm<=ms&&s.ultimaInteracaoEm+600000>ms)validadeMs=Math.min(validadeMs,s.ultimaInteracaoEm+600000-ms);
  }
 }
 return{tokenModal:consulta.tokenModal,pessoas,validadeMs:Math.max(1,Math.floor(validadeMs))};
}
