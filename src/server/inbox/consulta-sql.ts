import { Prisma } from "@prisma/client";
import type { Db } from "@/server/whatsapp/escopo";
import type { PreferenciaDoAtendimento } from "@/server/whatsapp/preferencias-consulta";
import type { CursorInbox } from "./cursor";
import type { ContagensChipsInbox, FiltrosInbox } from "./filtros";
import { filtrosEmSql, naoLidaPessoalEmSql, type ContextoFiltroSql } from "./filtros-sql";
import { RELACOES_ESTADO_ARIA } from "./estado-aria-sql";
import { contagemSegura } from "./contagens";

type ContextoConsulta = ContextoFiltroSql & { db:Db };
export interface IdPaginaInbox { id:string; ultimaMensagemEm:Date|null }
export function depoisDoCursorEmSql(c:CursorInbox):Prisma.Sql {
  if(c.em===null)return Prisma.sql`a."ultimaMensagemEm" IS NULL AND a."id" < ${c.id}::text`;
  const instante=new Date(c.em).toISOString();
  return Prisma.sql`(a."ultimaMensagemEm" < ${instante}::timestamp(3)
    OR (a."ultimaMensagemEm" = ${instante}::timestamp(3) AND a."id" < ${c.id}::text)
    OR a."ultimaMensagemEm" IS NULL)`;
}
export async function selecionarIdsPaginaInbox(ctx:ContextoConsulta,f:FiltrosInbox,pos:CursorInbox|null,tamanho:number):Promise<{fixadas:IdPaginaInbox[];normais:IdPaginaInbox[]}> {
  const where=filtrosEmSql(ctx,f);
  const fixada=Prisma.sql`EXISTS (SELECT 1 FROM "PreferenciaConversaUsuario" p WHERE p."conversaId" = a."conversaId" AND p."usuarioId" = ${ctx.usuarioId} AND p."fixadaEm" IS NOT NULL)`;
  const fixadas=pos?[]:await ctx.db.$queryRaw<IdPaginaInbox[]>(Prisma.sql`SELECT a."id",a."ultimaMensagemEm" FROM "AtendimentoWhatsApp" a ${RELACOES_ESTADO_ARIA}
    WHERE ${where} AND ${fixada} ORDER BY a."ultimaMensagemEm" DESC NULLS LAST,a."id" DESC LIMIT 100`);
  const normais=await ctx.db.$queryRaw<IdPaginaInbox[]>(Prisma.sql`SELECT a."id",a."ultimaMensagemEm" FROM "AtendimentoWhatsApp" a ${RELACOES_ESTADO_ARIA}
    WHERE ${where} AND NOT (${fixada}) ${pos?Prisma.sql`AND (${depoisDoCursorEmSql(pos)})`:Prisma.empty}
    ORDER BY a."ultimaMensagemEm" DESC NULLS LAST,a."id" DESC LIMIT ${tamanho+1}`);
  return {fixadas,normais};
}
export async function preferenciasDaPaginaSql(db:Db,usuarioId:string,ids:readonly string[],agora:Date):Promise<Map<string,PreferenciaDoAtendimento>> {
  if(!ids.length)return new Map();
  const linhas=await db.$queryRaw<{id:string;fixada:boolean;silenciada:boolean;naoLidas:bigint}[]>(Prisma.sql`
    SELECT a."id",(p."fixadaEm" IS NOT NULL) AS fixada,
      COALESCE(p."silenciadaAte" > ${agora.toISOString()}::timestamp(3),FALSE) AS silenciada,
      CASE WHEN p."marcadaNaoLida" THEN GREATEST(1::bigint,b.n) ELSE b.n END AS "naoLidas"
    FROM "AtendimentoWhatsApp" a
    LEFT JOIN "PreferenciaConversaUsuario" p ON p."conversaId" = a."conversaId" AND p."usuarioId" = ${usuarioId}
    CROSS JOIN LATERAL (SELECT CASE WHEN p."lidaAte" IS NULL THEN a."naoLidas"::bigint ELSE
      (SELECT COUNT(*) FROM "MensagemWhatsApp" m WHERE m."atendimentoId" = a."id" AND m."direcao" = 'ENTRADA' AND m."criadoEm" > p."lidaAte") END AS n) b
    WHERE a."id" = ANY(${[...new Set(ids)]}::text[])`);
  return new Map(linhas.map(r=>{
    if(typeof r.naoLidas!=="bigint"||r.naoLidas>BigInt(Number.MAX_SAFE_INTEGER)||r.naoLidas<BigInt(Number.MIN_SAFE_INTEGER))throw Error("Leitura Inbox fora do intervalo inteiro seguro.");
    return [r.id,{fixada:r.fixada,silenciada:r.silenciada,naoLidas:Number(r.naoLidas)}];
  }));
}
export async function contarLegadosComContexto(ctx:ContextoConsulta,f:FiltrosInbox):Promise<ContagensChipsInbox> {
  const base={...f,responsavel:undefined,naoLidas:undefined,prazoEstourado:undefined};
  const [r]=await ctx.db.$queryRaw<{[K in keyof ContagensChipsInbox]:bigint}[]>(Prisma.sql`
    SELECT COUNT(*) AS todas,COUNT(*) FILTER (WHERE a."responsavelId" = ${ctx.usuarioId}) AS minhas,
      COUNT(*) FILTER (WHERE ${naoLidaPessoalEmSql(ctx.usuarioId)}) AS "naoLidas",
      COUNT(*) FILTER (WHERE a."prazoRespostaEm" < ${ctx.agora.toISOString()}::timestamp(3) AND a."primeiraRespostaEm" IS NULL AND a."encerradoEm" IS NULL) AS prazo,
      COUNT(*) FILTER (WHERE a."responsavelId" IS NULL AND a."encerradoEm" IS NULL) AS fila
    FROM "AtendimentoWhatsApp" a ${RELACOES_ESTADO_ARIA} WHERE ${filtrosEmSql(ctx,base)}`);
  if(!r)throw Error("Agregado legado Inbox não retornou resultado.");
  return {todas:contagemSegura(r.todas),minhas:contagemSegura(r.minhas),naoLidas:contagemSegura(r.naoLidas),prazo:contagemSegura(r.prazo),fila:contagemSegura(r.fila)};
}
