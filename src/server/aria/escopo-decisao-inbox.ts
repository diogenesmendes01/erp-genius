import { Papel } from "@prisma/client";
import type { UsuarioSessao } from "../_shared/sessao";

export interface ContextoResponsavelAria {
  id: string;
  finalidade: string;
  responsavelId: string | null;
  leadId: string | null;
}
export interface AlvoResponsavelAria {
  atendimentoId: string | null;
  oportunidadeId: string | null;
}
export function excecaoResponsavelNoInbox(
  u: Pick<UsuarioSessao, "id" | "papeis">,
  atendimento: ContextoResponsavelAria,
  acao: AlvoResponsavelAria,
  leadAtualExiste: boolean,
): boolean {
  return u.papeis.includes(Papel.VENDEDOR)
    && atendimento.finalidade === "COMERCIAL"
    && atendimento.responsavelId === u.id
    && acao.atendimentoId === atendimento.id
    && !!atendimento.leadId
    && leadAtualExiste
    && (acao.oportunidadeId ?? atendimento.leadId) === atendimento.leadId;
}

import type { Db } from "../whatsapp/escopo";
import { capacidadesAria } from "./permissoes-tela";
import { leadsDecidiveis } from "./escopo-decisao";

export interface AcaoDecisaoInbox extends AlvoResponsavelAria {
  id: string;
  acao: string;
  payload: unknown;
}
export function pessoaDoPayloadValida(acao: Pick<AcaoDecisaoInbox,"acao"|"payload">, pessoaId: string | null): boolean {
  if(acao.acao!=="TAG"&&acao.acao!=="ATUALIZAR_CAMPO")return true;
  const p=acao.payload!==null&&typeof acao.payload==="object"&&!Array.isArray(acao.payload)?acao.payload as Record<string,unknown>:null;
  return !!pessoaId&&p?.pessoaId===pessoaId;
}
export const usaLeadAtualNaResposta = (acao: Pick<AcaoDecisaoInbox,"acao">): boolean => acao.acao === "RESPONDER" || acao.acao === "ENVIAR_DOCUMENTO";
export async function acoesDecidiveisNoInbox(db: Db, u: UsuarioSessao, atendimento: ContextoResponsavelAria, acoes: readonly AcaoDecisaoInbox[]): Promise<Set<string>> {
  const leadIds=acoes.flatMap(a=>usaLeadAtualNaResposta(a)?[a.oportunidadeId??atendimento.leadId,atendimento.leadId]:[a.oportunidadeId??atendimento.leadId]);
  const ids=[...new Set(leadIds.filter((id):id is string=>!!id))];
  const leads=ids.length?await db.oportunidade.findMany({where:{id:{in:ids}},select:{id:true,pessoaId:true}}):[];
  const porId=new Map(leads.map(l=>[l.id,l]));
  const globais=capacidadesAria(u).has("decidirHistorico")?await leadsDecidiveis(db,u,leadIds):new Set<string|null>();
  const permitidas=new Set<string>();
  for(const acao of acoes){
    if(acao.atendimentoId!==atendimento.id)continue;
    const leadId=acao.oportunidadeId??atendimento.leadId;
    const lead=leadId?porId.get(leadId):null;
    if(!pessoaDoPayloadValida(acao,lead?.pessoaId??null))continue;
    const escopoGlobal=globais.has(leadId)&&(!usaLeadAtualNaResposta(acao)||acao.oportunidadeId===null||acao.oportunidadeId===atendimento.leadId||globais.has(atendimento.leadId));
    if(escopoGlobal||excecaoResponsavelNoInbox(u,atendimento,acao,!!lead&&lead.id===atendimento.leadId))permitidas.add(acao.id);
  }
  return permitidas;
}
