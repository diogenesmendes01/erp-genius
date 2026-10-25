import {ACAO_AGENTE_IA_LABEL,rotular} from "@/lib/labels";
import type {AcaoAgenteIA,AcaoAgenteIATipo,EtapaLead,Prisma} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import type {UsuarioSessao} from "@/server/_shared/sessao";
import {escopoComercialAtual} from "@/server/_shared/escopo-comercial";
import {atendimentoVisivel} from "@/server/whatsapp/atendimentos";
import {podeVerLeadNaThread} from "@/server/whatsapp/visibilidade-lead";
import {acoesDecidiveisNoInbox,pessoaDoPayloadValida} from "@/server/aria/escopo-decisao-inbox";
import {configPadrao,modoDaAcao} from "@/server/aria/config-schema";
import {ACOES_MATRIZ} from "@/server/aria/matriz";
import {versaoPublicada} from "@/server/aria/versoes";
import {textoAlteracaoAria} from "./atividade-aria-texto";
export type AlteracaoAriaPainel={id:string;acao:AcaoAgenteIATipo;texto:string;em:string;desfeita:boolean;podeDesfazer:boolean;motivoIrreversivel:string|null};
export type AriaNoContato={ultimaAcao:{texto:string;confianca:number;em:string}|null;faixa:{executaAPartirDe:number;transfereAbaixoDe:number};etapa:EtapaLead|null;automatico:AcaoAgenteIATipo[];comAprovacao:AcaoAgenteIATipo[]};
export type AriaAtividade={aria:AriaNoContato|null;alteracoes:AlteracaoAriaPainel[];contadorAtividade:number};
/** Leitura e decisão são políticas distintas; limite aplicado somente depois da autorização. */
export async function carregarAriaAtividade(u:UsuarioSessao,atendimentoId:string):Promise<AriaAtividade>{
 const vazio:AriaAtividade={aria:null,alteracoes:[],contadorAtividade:0};
 const a=await atendimentoVisivel(u,atendimentoId);
 if(!a||a.finalidade!=="COMERCIAL"||!a.leadId||!await podeVerLeadNaThread(u,a.id,a.leadId,Date.now()))return vazio;
 const atual=await prisma.oportunidade.findUnique({where:{id:a.leadId},select:{id:true,pessoaId:true,etapa:true}});
 if(!atual)return vazio;
 const escopoHistorico=await escopoComercialAtual(u);
 async function autorizadas(candidatas:AcaoAgenteIA[]):Promise<AcaoAgenteIA[]>{
  const ids=[...new Set(candidatas.map(c=>c.oportunidadeId).filter((id):id is string=>!!id&&id!==atual!.id))];
  const historicos=ids.length?await prisma.oportunidade.findMany({where:{AND:[{id:{in:ids}},escopoHistorico]},select:{id:true,pessoaId:true}}):[];
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
   const lote=await prisma.acaoAgenteIA.findMany({where:{AND:[{atendimentoId:a!.id},where,...(cursor?[{OR:[{criadoEm:{lt:cursor.criadoEm}},{criadoEm:cursor.criadoEm,id:{lt:cursor.id}}]}]:[])]},orderBy:[{criadoEm:"desc"},{id:"desc"}],take:100});
   resultado.push(...await autorizadas(lote));
   if(lote.length<100)break;
   const ultimo=lote[lote.length-1];cursor={id:ultimo.id,criadoEm:ultimo.criadoEm};
  }
  return resultado.slice(0,limite);
 }
 const [lista,ultimas,publicada]=await Promise.all([
  pagina({status:{in:["EXECUTADA","APROVADA","DESFEITA"]},acao:{not:"CLASSIFICAR_SETOR"}},30),
  pagina({status:{not:"SIMULADA"}},1),versaoPublicada(),
 ]);
 // Uma publicação inválida lança erro: só ausência permite o padrão canônico.
 const config=publicada?.config??configPadrao();
 const decidiveis=await acoesDecidiveisNoInbox(prisma,u,a,lista);
 const alteracoes=lista.map(c=>({id:c.id,acao:c.acao,texto:textoAlteracaoAria(c.acao,c.payload),em:c.criadoEm.toISOString(),desfeita:c.status==="DESFEITA",podeDesfazer:decidiveis.has(c.id)&&c.reversivel&&(c.status==="EXECUTADA"||c.status==="APROVADA"),motivoIrreversivel:c.reversivel?null:c.motivoIrreversivel}));
 const ultima=ultimas[0];
 return {aria:{ultimaAcao:ultima?{texto:["EXECUTADA","APROVADA","DESFEITA"].includes(ultima.status)?textoAlteracaoAria(ultima.acao,ultima.payload):rotular(ACAO_AGENTE_IA_LABEL,ultima.acao),confianca:ultima.confianca,em:ultima.criadoEm.toISOString()}:null,faixa:{executaAPartirDe:config.confianca.executaAPartirDe,transfereAbaixoDe:config.confianca.transfereAbaixoDe},etapa:atual.etapa,automatico:ACOES_MATRIZ.filter(c=>modoDaAcao(config,atual.etapa,c)==="EXECUTA"),comAprovacao:ACOES_MATRIZ.filter(c=>modoDaAcao(config,atual.etapa,c)==="SUGERE")},alteracoes,contadorAtividade:lista.filter(c=>c.status==="EXECUTADA"||c.status==="APROVADA").length};
}