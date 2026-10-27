import type { EstadoPolitica, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";
import { situacaoAria } from "@/server/aria/estado";
import { estadoOrcamento } from "@/server/aria/uso";
import { capacidadesAria } from "@/server/aria/permissoes-tela";
import { escopoAtendimentos, type Db } from "@/server/whatsapp/escopo";
import { ariaAtivaGlobal } from "./estado-aria";

export interface SituacaoAriaInbox { estado:EstadoPolitica; pausada:boolean; podeGerenciar:boolean }
export interface ContextoListaInbox {
  readonly db:Db; readonly usuarioId:string; readonly agora:Date;
  readonly escopo:Prisma.AtendimentoWhatsAppWhereInput;
  readonly ariaAtiva:boolean; readonly aria:SituacaoAriaInbox;
}
export interface OperacaoListaInbox {
  readonly db:Db; readonly usuarioId:string; readonly papeisChave:string; readonly agora:Date; readonly enviar:boolean;
  escopo():Promise<Prisma.AtendimentoWhatsAppWhereInput>;
  global():Promise<ContextoListaInbox>;
}
export interface OpcoesOperacaoInbox { db?:Db; agora?:Date; enviar?:boolean; operacao?:OperacaoListaInbox }
export function criarOperacaoListaInbox(u:UsuarioSessao,o:Omit<OpcoesOperacaoInbox,"operacao">={}):OperacaoListaInbox {
  const db=o.db??prisma,agora=new Date((o.agora??new Date()).getTime()),enviar=o.enviar===true;
  if(!Number.isFinite(agora.getTime()))throw Error("Instante Inbox inválido.");
  const usuario={...u,papeis:[...u.papeis]};
  let promessaEscopo:Promise<Prisma.AtendimentoWhatsAppWhereInput>|undefined;
  let promessaGlobal:Promise<ContextoListaInbox>|undefined;
  const escopo=()=>promessaEscopo??=Promise.resolve().then(()=>escopoAtendimentos(usuario,{db,agora,enviar}));
  const global=()=>promessaGlobal??=Promise.resolve().then(async()=>{
    const s=await situacaoAria(agora,db);
    const orcamento=await estadoOrcamento(agora,db);
    return {db,usuarioId:usuario.id,agora,escopo:await escopo(),
      ariaAtiva:ariaAtivaGlobal({estado:s.estado,pausada:s.pausada,temVersao:s.versao!==null},orcamento),
      aria:{estado:s.estado,pausada:s.pausada,podeGerenciar:capacidadesAria(usuario).has("pausar")}};
  });
  return Object.freeze({db,usuarioId:usuario.id,papeisChave:JSON.stringify([...usuario.papeis].sort()),agora,enviar,escopo,global});
}
export function resolverOperacaoListaInbox(u:UsuarioSessao,o:OpcoesOperacaoInbox={}):OperacaoListaInbox {
  const op=o.operacao;
  if(!op)return criarOperacaoListaInbox(u,o);
  if(op.usuarioId!==u.id || op.papeisChave!==JSON.stringify([...u.papeis].sort()) || (o.db!==undefined&&o.db!==op.db)
    || (o.enviar!==undefined&&o.enviar!==op.enviar) || (o.agora!==undefined&&o.agora.getTime()!==op.agora.getTime()))throw Error("Operação Inbox de outro contexto.");
  return op;
}
export async function carregarContextoListaInbox(db:Db,u:UsuarioSessao,agora:Date=new Date(),enviar=false):Promise<ContextoListaInbox> {
  return criarOperacaoListaInbox(u,{db,agora,enviar}).global();
}
