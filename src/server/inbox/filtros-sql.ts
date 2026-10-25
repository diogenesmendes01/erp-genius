import { Prisma } from "@prisma/client";
import { whereBuscaConversas } from "@/server/whatsapp/busca-inbox";
import type { FiltrosInbox } from "./filtros";
import { ESTADOS_ARIA } from "./estado-aria-valores";
import { estadoAriaEmSql } from "./estado-aria-sql";
import { whereAtendimentoEmSql } from "./where-sql";
export interface ContextoFiltroSql { usuarioId:string; agora:Date; escopo:Prisma.AtendimentoWhatsAppWhereInput; ariaAtiva?:boolean }
export const CONDICAO_FILA:Prisma.AtendimentoWhatsAppWhereInput=Object.freeze({responsavelId:null,encerradoEm:null});
export const condicaoPrazoEstourado=(agora:Date):Prisma.AtendimentoWhatsAppWhereInput=>({prazoRespostaEm:{lt:agora},primeiraRespostaEm:null,encerradoEm:null});
/** Somente parte expressável em WhereInput. Aria e leitura pessoal são composições SQL separadas. */
export function condicoesWhereDosFiltros(usuarioId:string,f:FiltrosInbox,agora:Date):Prisma.AtendimentoWhatsAppWhereInput[] {
  const c:Prisma.AtendimentoWhatsAppWhereInput[]=[];
  if(f.setor)c.push({finalidade:f.setor});
  if(f.numeroId)c.push({conversa:{numeroId:f.numeroId}});
  if(f.responsavel==="eu")c.push({responsavelId:usuarioId});
  else if(f.responsavel==="fila")c.push(CONDICAO_FILA);
  else if(f.responsavel)c.push({responsavelId:f.responsavel});
  if(f.status)c.push({status:f.status});
  if(f.prazoEstourado)c.push(condicaoPrazoEstourado(agora));
  if(f.busca)c.push(whereBuscaConversas(f.busca));
  return c;
}
export function naoLidaPessoalEmSql(usuarioId:string):Prisma.Sql {
  return Prisma.sql`(EXISTS (SELECT 1 FROM "PreferenciaConversaUsuario" p
      WHERE p."conversaId" = a."conversaId" AND p."usuarioId" = ${usuarioId} AND p."marcadaNaoLida" = TRUE)
    OR (a."naoLidas" > 0 AND NOT EXISTS (SELECT 1 FROM "PreferenciaConversaUsuario" p
      WHERE p."conversaId" = a."conversaId" AND p."usuarioId" = ${usuarioId} AND p."lidaAte" IS NOT NULL))
    OR EXISTS (SELECT 1 FROM "PreferenciaConversaUsuario" p
      WHERE p."conversaId" = a."conversaId" AND p."usuarioId" = ${usuarioId} AND p."lidaAte" IS NOT NULL
        AND EXISTS (SELECT 1 FROM "MensagemWhatsApp" m
          WHERE m."atendimentoId" = a."id" AND m."direcao" = 'ENTRADA' AND m."criadoEm" > p."lidaAte")))`;
}
/** Sempre somar o escopo. Nenhum Prisma.Sql é convertido por cast em WhereInput. */
export function filtrosEmSql(ctx:ContextoFiltroSql,f:FiltrosInbox):Prisma.Sql {
  const partes=[whereAtendimentoEmSql({AND:[ctx.escopo,...condicoesWhereDosFiltros(ctx.usuarioId,f,ctx.agora)]})];
  if(f.naoLidas)partes.push(naoLidaPessoalEmSql(ctx.usuarioId));
  if(f.aria){
    if(typeof ctx.ariaAtiva!=="boolean" || !(ESTADOS_ARIA as readonly string[]).includes(f.aria))throw Error("Estado/contexto Aria inválido para filtro.");
    partes.push(Prisma.sql`(${estadoAriaEmSql(ctx.ariaAtiva,ctx.agora)}) = ${f.aria}::text`);
  }
  return Prisma.sql`(${Prisma.join(partes.map(p=>Prisma.sql`(${p})`)," AND ")})`;
}
