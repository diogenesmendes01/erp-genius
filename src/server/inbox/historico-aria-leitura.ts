import type {AcaoAgenteIA,Prisma} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import type {UsuarioSessao} from "@/server/_shared/sessao";
import {escopoComercialAtual} from "@/server/_shared/escopo-comercial";
import {atendimentoVisivel} from "@/server/whatsapp/atendimentos";
import {podeVerLeadNaThread} from "@/server/whatsapp/visibilidade-lead";
import type {Db} from "@/server/whatsapp/escopo";
import {pessoaDoPayloadValida} from "@/server/aria/escopo-decisao-inbox";
/** Leitura autorizada compartilhada; não carrega configuração nem calcula decisão. */
export async function criarLeitorHistoricoAria(u:UsuarioSessao,atendimentoId:string,db:Db=prisma){
 const a=await (db===prisma?atendimentoVisivel(u,atendimentoId):atendimentoVisivel(u,atendimentoId,false,db));
 if(!a||a.finalidade!=="COMERCIAL"||!a.leadId||!await podeVerLeadNaThread(u,a.id,a.leadId,Date.now(),db))return null;
 const atual=await db.oportunidade.findUnique({where:{id:a.leadId},select:{id:true,pessoaId:true,etapa:true}});
 if(!atual)return null;
 const escopoHistorico=await escopoComercialAtual(u,db);
 async function autorizadas(candidatas:AcaoAgenteIA[]):Promise<AcaoAgenteIA[]>{
  const ids=[...new Set(candidatas.map(c=>c.oportunidadeId).filter((id):id is string=>!!id&&id!==atual!.id))];
  const historicos=ids.length?await db.oportunidade.findMany({where:{AND:[{id:{in:ids}},escopoHistorico]},select:{id:true,pessoaId:true}}):[];
  const leads=new Map([atual!,...historicos].map(l=>[l.id,l]));
  return candidatas.filter(c=>{
   const lead=leads.get(c.oportunidadeId??atual!.id);
   if(!lead||!pessoaDoPayloadValida(c,lead.pessoaId))return false;
   const p=c.payload!==null&&typeof c.payload==="object"&&!Array.isArray(c.payload)?c.payload as Record<string,unknown>:{};
   return !('pessoaId' in p)||p.pessoaId===lead.pessoaId;
  });
 }
 async function pagina(where:Prisma.AcaoAgenteIAWhereInput,limite:number){
  const resultado:AcaoAgenteIA[]=[];let cursor:{id:string;criadoEm:Date}|null=null;
  while(resultado.length<limite){
   const lote:AcaoAgenteIA[]=await db.acaoAgenteIA.findMany({where:{AND:[{atendimentoId:a!.id},where,...(cursor?[{OR:[{criadoEm:{lt:cursor.criadoEm}},{criadoEm:cursor.criadoEm,id:{lt:cursor.id}}]}]:[])]},orderBy:[{criadoEm:"desc"},{id:"desc"}],take:100});
   resultado.push(...await autorizadas(lote));
   if(lote.length<100)break;
   const ultimo:AcaoAgenteIA=lote[lote.length-1];cursor={id:ultimo.id,criadoEm:ultimo.criadoEm};
  }
  return resultado.slice(0,limite);
 }
 return {atendimento:a,leadAtual:atual,pagina,
  alteracoes:()=>pagina({status:{in:["EXECUTADA","APROVADA","DESFEITA"]},acao:{not:"CLASSIFICAR_SETOR"}},30)};
}
/** DESFEITA ocupa a janela autorizada, mas não conta como alteração vigente. */
export function contarAlteracoesExecutadas(lista:readonly Pick<AcaoAgenteIA,"status">[]):number{
 return lista.filter(c=>c.status==="EXECUTADA"||c.status==="APROVADA").length;
}
export async function carregarContadorAtividadeAria(u:UsuarioSessao,atendimentoId:string,db:Db=prisma):Promise<number>{
 const leitor=await criarLeitorHistoricoAria(u,atendimentoId,db);
 return leitor?contarAlteracoesExecutadas(await leitor.alteracoes()):0;
}
