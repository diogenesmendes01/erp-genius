import { Prisma, type EstadoPolitica } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared";
import { situacaoAria } from "@/server/aria/estado";
import { estadoOrcamento } from "@/server/aria/uso";
import { capacidadesAria } from "@/server/aria/permissoes-tela";
import { escopoAtendimentos, type Db } from "@/server/whatsapp/escopo";
import { whereBuscaConversas } from "@/server/whatsapp/busca-inbox";
import { ariaAtivaGlobal, type EstadoAria } from "./estado-aria";
import type { FiltrosInbox } from "./filtros";
import { whereAtendimentoEmSql } from "./where-sql";
import { estadoAriaEmSql, RELACOES_ESTADO_ARIA } from "./estado-aria-sql";

export interface ContagemChipsInbox { todas:number; ia:number; aprovacao:number; handoff:number; humano:number; semResposta:number; naoAtribuidas:number }
export interface SituacaoAriaInbox { estado:EstadoPolitica; pausada:boolean; podeGerenciar:boolean }
export interface ResumoListaInbox { contagens:ContagemChipsInbox; aria:SituacaoAriaInbox }
/** Tipo aditivo local até o parser/consumidores do marco3. */
export type FiltrosResumoInbox = FiltrosInbox & { aria?:EstadoAria };
/** Somente servidor. Não receber contexto/where/Db do cliente HTTP. */
export interface ContextoListaInbox {
  readonly db:Db; readonly usuarioId:string; readonly agora:Date;
  readonly escopo:Prisma.AtendimentoWhatsAppWhereInput;
  readonly ariaAtiva:boolean; readonly aria:SituacaoAriaInbox;
}
export async function carregarContextoListaInbox(db:Db,u:UsuarioSessao,agora:Date=new Date(),enviar=false):Promise<ContextoListaInbox> {
  const instante=new Date(agora.getTime());
  const s=await situacaoAria(instante,db);
  // ConfigIA conserva o upsert legado de estadoOrcamento; não há outro bootstrap oculto.
  const o=await estadoOrcamento(instante,db);
  const escopo=await escopoAtendimentos(u,{db,agora:instante,enviar});
  return {db,usuarioId:u.id,agora:instante,escopo,
    ariaAtiva:ariaAtivaGlobal({estado:s.estado,pausada:s.pausada,temVersao:s.versao!==null},o),
    aria:{estado:s.estado,pausada:s.pausada,podeGerenciar:capacidadesAria(u).has("pausar")}};
}
/** COUNT devolve bigint no Postgres. Não truncar nem converter silenciosamente para int32. */
export function contagemSegura(v:unknown):number {
  if(typeof v!=="bigint" || v<0n || v>BigInt(Number.MAX_SAFE_INTEGER)) throw Error("Contagem Inbox fora do intervalo inteiro seguro.");
  return Number(v);
}

/** Base nova: aria e prazo saem; responsável sai somente quando fila. Não lidas é preservado em SQL abaixo. */
function filtrosBase(usuarioId:string,f:FiltrosResumoInbox):Prisma.AtendimentoWhatsAppWhereInput[] {
  const c:Prisma.AtendimentoWhatsAppWhereInput[]=[];
  if(f.setor)c.push({finalidade:f.setor});
  if(f.numeroId)c.push({conversa:{numeroId:f.numeroId}});
  if(f.responsavel==="eu")c.push({responsavelId:usuarioId});
  else if(f.responsavel && f.responsavel!=="fila")c.push({responsavelId:f.responsavel});
  if(f.status)c.push({status:f.status});
  if(f.busca)c.push(whereBuscaConversas(f.busca));
  return c;
}
/** Equivalente ao filtro pessoal canônico, sem a lista global de IDs comLeitura. */
function naoLidaPessoalEmSql(usuarioId:string):Prisma.Sql {
  return Prisma.sql`(EXISTS (SELECT 1 FROM "PreferenciaConversaUsuario" p
      WHERE p."conversaId" = a."conversaId" AND p."usuarioId" = ${usuarioId} AND p."marcadaNaoLida" = TRUE)
    OR (a."naoLidas" > 0 AND NOT EXISTS (SELECT 1 FROM "PreferenciaConversaUsuario" p
      WHERE p."conversaId" = a."conversaId" AND p."usuarioId" = ${usuarioId} AND p."lidaAte" IS NOT NULL))
    OR EXISTS (SELECT 1 FROM "PreferenciaConversaUsuario" p
      WHERE p."conversaId" = a."conversaId" AND p."usuarioId" = ${usuarioId} AND p."lidaAte" IS NOT NULL
        AND EXISTS (SELECT 1 FROM "MensagemWhatsApp" m
          WHERE m."atendimentoId" = a."id" AND m."direcao" = 'ENTRADA' AND m."criadoEm" > p."lidaAte")))`;
}
type ContagensRaw = { [K in keyof ContagemChipsInbox]: bigint };
/** Reutiliza o mesmo snapshot global/ACL na futura fase3, mas executa uma agregação por chamada. */
export async function resumoComContexto(ctx:ContextoListaInbox,f:FiltrosResumoInbox):Promise<ResumoListaInbox> {
  const where=whereAtendimentoEmSql({AND:[ctx.escopo,...filtrosBase(ctx.usuarioId,f)]});
  const [r]=await ctx.db.$queryRaw<ContagensRaw[]>(Prisma.sql`
    WITH base AS (
      SELECT a."id",a."responsavelId",a."encerradoEm",a."prazoRespostaEm",a."primeiraRespostaEm",
        ${estadoAriaEmSql(ctx.ariaAtiva,ctx.agora)} AS estado
      FROM "AtendimentoWhatsApp" a ${RELACOES_ESTADO_ARIA}
      WHERE ${where} AND ${f.naoLidas?naoLidaPessoalEmSql(ctx.usuarioId):Prisma.sql`TRUE`}
    )
    SELECT COUNT(*) AS todas,
      COUNT(*) FILTER (WHERE estado = ${"ia"}::text) AS ia,
      COUNT(*) FILTER (WHERE estado = ${"aprovacao"}::text) AS aprovacao,
      COUNT(*) FILTER (WHERE estado = ${"handoff"}::text) AS handoff,
      COUNT(*) FILTER (WHERE estado = ${"humano"}::text) AS humano,
      COUNT(*) FILTER (WHERE "prazoRespostaEm" < ${ctx.agora.toISOString()}::timestamp(3)
        AND "primeiraRespostaEm" IS NULL AND "encerradoEm" IS NULL) AS "semResposta",
      COUNT(*) FILTER (WHERE "responsavelId" IS NULL AND "encerradoEm" IS NULL) AS "naoAtribuidas"
    FROM base`);
  if(!r)throw Error("Agregado Inbox não retornou resultado.");
  return {contagens:{todas:contagemSegura(r.todas),ia:contagemSegura(r.ia),aprovacao:contagemSegura(r.aprovacao),handoff:contagemSegura(r.handoff),humano:contagemSegura(r.humano),semResposta:contagemSegura(r.semResposta),naoAtribuidas:contagemSegura(r.naoAtribuidas)},aria:ctx.aria};
}
export async function resumoDaListaInbox(u:UsuarioSessao,f:FiltrosResumoInbox,agora:Date=new Date(),o:{db?:Db;enviar?:boolean}={}):Promise<ResumoListaInbox> {
  return resumoComContexto(await carregarContextoListaInbox(o.db??prisma,u,agora,o.enviar===true),f);
}
