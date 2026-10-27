"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/server/_shared";
import { apenasPortal } from "@/server/_shared/sessao";
import { podeExecutar } from "@/server/inbox/permissoes";
import { atendimentoVisivel } from "./atendimentos";
import { contextoPessoas } from "./pessoas-atendimento";
import { ehGerenteDoSetor, papeisDoSetor, type Setor } from "./setor";
import { Papel } from "@prisma/client";
import { resumoDaAriaParaNota } from "@/server/aria/resumo-nota";
import { lerAgendadasDoAtendimento, type AgendadaNoFio } from "@/server/inbox/agendadas-leitura";
import { propostasVisiveis, type PropostaAnexavel } from "./proposta-atendimento";
import { contatosCompartilhaveis, type ContatoCartao } from "./contatos-cartao";

const IdSchema = z.string().min(1);

export async function agendadasDoAtendimento(atendimentoId: string): Promise<AgendadaNoFio[]> {
  const u = await exigirSessao();
  const id = IdSchema.parse(atendimentoId);
  return lerAgendadasDoAtendimento(prisma, u.id, id);
}

export async function propostasDoAtendimento(atendimentoId: string): Promise<{ oportunidadeId: string | null; propostas: PropostaAnexavel[] }> {
  const u = await exigirSessao();
  const { oportunidadeId, propostas } = await propostasVisiveis(u, IdSchema.parse(atendimentoId));
  return { oportunidadeId, propostas: propostas.map(({ id, nome, criadoEm }) => ({ id, nome, criadoEm })) };
}

export async function contatosParaCartao(atendimentoId: string): Promise<ContatoCartao[]> {
  const u = await exigirSessao();
  return contatosCompartilhaveis(u, IdSchema.parse(atendimentoId));
}

export async function listarPessoasParaAtendimento(atendimentoId:string,para:"atribuir"|"convidar"):Promise<{id:string;nome:string}[]>{
  const u=await exigirSessao(),id=IdSchema.parse(atendimentoId);
  return(await contextoPessoas(u,id,para))?.pessoas??[];
}
const CargaIdsSchema=z.array(IdSchema).max(200);
export async function cargaDasPessoas(atendimentoId:string,usuarioIds:string[]):Promise<Record<string,number>>{
  const u=await exigirSessao(),id=IdSchema.parse(atendimentoId);
  const pedidos=[...new Set(CargaIdsSchema.parse(usuarioIds))];if(!pedidos.length)return{};
  const c=await contextoPessoas(u,id,"atribuir");if(!c||c.a.conversa?.grupoId)return{};
  const listados=new Set(c.pessoas.map(p=>p.id));
  const ids=pedidos.filter(p=>listados.has(p)&&p!==c.a.responsavelId&&p!==u.id);if(!ids.length)return{};
  const papeis=papeisDoSetor(c.a.finalidade);
  const grupos=await prisma.atendimentoWhatsApp.groupBy({by:["responsavelId"],_count:{_all:true},where:{
    finalidade:c.a.finalidade,encerradoEm:null,status:{not:"ENCERRADO"},responsavelId:{in:ids},
    responsavel:{is:{ativo:true,papeis:{hasSome:papeis}}},
  }});
  const fresco=await prisma.usuario.findUnique({where:{id:u.id},select:{id:true,nome:true,papeis:true,ativo:true}});
  if(!fresco?.ativo||apenasPortal(fresco))return{};
  const atual=await atendimentoVisivel(fresco,id);
  if(!atual||atual.encerradoEm||atual.conversa?.grupoId||atual.finalidade!==c.a.finalidade||!podeExecutar(fresco,"atribuir",{setor:atual.finalidade,responsavelId:atual.responsavelId}))return{};
  const validos=await prisma.usuario.findMany({where:{id:{in:ids,notIn:[fresco.id,...(atual.responsavelId?[atual.responsavelId]:[])]},ativo:true,papeis:{hasSome:papeis}},select:{id:true}});
  const porPessoa=new Map(grupos.flatMap(g=>g.responsavelId?[[g.responsavelId,g._count._all] as const]:[]));
  const autorizados=new Set(ids);
  return Object.fromEntries(validos.filter(p=>autorizados.has(p.id)).map(p=>[p.id,porPessoa.get(p.id)??0]));
}
export async function origemVisivelDaTransferencia(origemId: string): Promise<{ setor: Setor } | null> {
  const u = await exigirSessao();
  const o = await atendimentoVisivel(u, IdSchema.parse(origemId));
  return o ? { setor: o.finalidade } : null;
}

export interface ConviteAtivo { id: string; nome: string; fim: string; podeEnviar: boolean }
export interface AgendamentoAtivo { id: string; texto: string; agendadaPara: string }

export async function listarConvitesEAgendamentos(atendimentoId: string): Promise<{ convites: ConviteAtivo[]; agendamentos: AgendamentoAtivo[] }> {
  const u = await exigirSessao();
  const id = IdSchema.parse(atendimentoId);
  const a = await atendimentoVisivel(u, id);
  if (!a || a.encerradoEm) return { convites: [], agendamentos: [] };
  const agora = new Date();
  const admin = u.papeis.includes(Papel.ADMINISTRADOR);
  const gerente = ehGerenteDoSetor(u.papeis, a.finalidade);
  const [convites, agendadas] = await Promise.all([
    prisma.participanteAtendimentoWhatsApp.findMany({
      where: { atendimentoId: id, revogadoEm: null, fim: { gt: agora }, ...(admin || gerente ? {} : { concedenteId: u.id }) },
      select: { id: true, fim: true, podeEnviar: true, usuario: { select: { nome: true } } }, orderBy: { fim: "asc" }, take: 50,
    }),
    prisma.intencaoMensagem.findMany({
      where: { atendimentoId: id, origem: "HUMANO", agendadaPara: { not: null }, passo: null, passoComercial: null, status: { in: ["PENDENTE", "ADIADA"] }, ...(admin ? {} : { autorId: u.id }) },
      select: { id: true, corpoRenderizado: true, agendadaPara: true }, orderBy: { agendadaPara: "asc" }, take: 50,
    }),
  ]);
  return {
    convites: convites.map((c) => ({ id: c.id, nome: c.usuario.nome, fim: c.fim.toISOString(), podeEnviar: c.podeEnviar })),
    agendamentos: agendadas.map((m) => ({ id: m.id, texto: m.corpoRenderizado, agendadaPara: m.agendadaPara!.toISOString() })),
  };
}
export async function temResumoDaAria(atendimentoId: string): Promise<boolean> {
  const u = await exigirSessao();
  const id = IdSchema.parse(atendimentoId);
  const a = await atendimentoVisivel(u, id);
  if (!a || a.encerradoEm || !podeExecutar(u, "transferir", { setor: a.finalidade, responsavelId: a.responsavelId })) return false;
  return (await resumoDaAriaParaNota(prisma, id)) !== null;
}
