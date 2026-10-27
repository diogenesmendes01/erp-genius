import { resolverOperacaoListaInbox, type ContextoListaInbox, type SituacaoAriaInbox, type OpcoesOperacaoInbox } from "./contexto-lista";
export { carregarContextoListaInbox } from "./contexto-lista";
export type { ContextoListaInbox, SituacaoAriaInbox };
import { filtrosEmSql } from "./filtros-sql";
import { Prisma } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared";
import type { EstadoAria } from "./estado-aria-valores";
import type { FiltrosInbox } from "./filtros";
import { estadoAriaEmSql, RELACOES_ESTADO_ARIA } from "./estado-aria-sql";

export interface ContagemChipsInbox { todas:number; ia:number; aprovacao:number; handoff:number; humano:number; semResposta:number; naoAtribuidas:number }
export interface ResumoListaInbox { contagens:ContagemChipsInbox; aria:SituacaoAriaInbox }
export type FiltrosResumoInbox = FiltrosInbox & { aria?:EstadoAria };
export function contagemSegura(v:unknown):number {
  if(typeof v!=="bigint" || v<0n || v>BigInt(Number.MAX_SAFE_INTEGER)) throw Error("Contagem Inbox fora do intervalo inteiro seguro.");
  return Number(v);
}
type ContagensRaw = { [K in keyof ContagemChipsInbox]: bigint };
export async function resumoComContexto(ctx:ContextoListaInbox,f:FiltrosResumoInbox):Promise<ResumoListaInbox> {
  const where=filtrosEmSql(ctx,{...f,aria:undefined,prazoEstourado:undefined,responsavel:f.responsavel==="fila"?undefined:f.responsavel});
  const [r]=await ctx.db.$queryRaw<ContagensRaw[]>(Prisma.sql`
    WITH base AS (
      SELECT a."id",a."responsavelId",a."encerradoEm",a."prazoRespostaEm",a."primeiraRespostaEm",
        ${estadoAriaEmSql(ctx.ariaAtiva,ctx.agora)} AS estado
      FROM "AtendimentoWhatsApp" a ${RELACOES_ESTADO_ARIA}
      WHERE ${where}
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
export async function resumoDaListaInbox(u:UsuarioSessao,f:FiltrosResumoInbox,agora?:Date,o:OpcoesOperacaoInbox={}):Promise<ResumoListaInbox> {
  return resumoComContexto(await resolverOperacaoListaInbox(u,{...o,...(agora?{agora}:{})}).global(),f);
}
