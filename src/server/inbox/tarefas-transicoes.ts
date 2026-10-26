import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, type UsuarioSessao } from "@/server/_shared/sessao";
import { atendimentoVisivel } from "@/server/whatsapp/atendimentos";
import { escopoTarefas } from "@/server/crm/tarefas";
import { capacidadesCrm, exigirCapacidadeCrm } from "@/server/crm/permissoes";
import { concluirTarefaTx, reabrirTarefaTx, reagendarTarefaTx, cancelarTarefaTx, type ContextoTransicaoTarefa } from "@/server/crm/tarefas-transicoes";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";
import { instanteDoCampoLocal, valorCampoLocal } from "@/server/operacao/fuso-entrada";
import { avisarAtendimento } from "./aviso";

export type ReagendamentoInbox = {dataCivil:string|null;hora:string|null;fusoEscolaEsperado:string};
const Id=z.string().min(1,"Tarefa não encontrada.");
const Versao=z.number().int().positive();
const DataCivil=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+"T00:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;},"Informe uma data válida.");
const Q=z.object({dataCivil:DataCivil.nullable(),hora:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),fusoEscolaEsperado:z.string().min(1)}).strict();
type Transicao = {tipo:"concluir"|"reabrir"}|{tipo:"cancelar";motivo:string}|{tipo:"reagendar";q:ReagendamentoInbox};
export async function executarTarefaInboxTx(sessao:UsuarioSessao,atendimentoId:string,tarefaId:string,versao:number,entrada:Transicao):Promise<void>{
 const id=Id.parse(atendimentoId),tid=Id.parse(tarefaId),v=Versao.parse(versao);
 const motivo=entrada.tipo==="cancelar"?z.string().trim().min(1,"Informe o motivo do cancelamento.").max(500,"O motivo deve ter até 500 caracteres.").parse(entrada.motivo):null;
 const q=entrada.tipo==="reagendar"?Q.parse(entrada.q):null;
 await prisma.$transaction(async tx=>{
  const fuso=q?await carregarFusoInstitucionalTx(tx):null;
  if(q&&(!fuso||fuso!==q.fusoEscolaEsperado))throw new ErroRegra("O fuso da escola mudou ou está indisponível. Recarregue o painel.");
  await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${id} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Tarefa" WHERE id=${tid} FOR UPDATE`;
  const contexto=async()=>{
   const fresco=await tx.usuario.findUnique({where:{id:sessao.id},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true}});
   if(!fresco?.ativo)throw new ErroRegra("Sua sessão não está mais ativa.");
   exigirCapacidadeCrm(fresco,"tarefas.ver");
   const a=await atendimentoVisivel(fresco,id,false,tx);
   if(!a)throw new ErroRegra("Atendimento não encontrado.");
   const pertence:Prisma.TarefaWhereInput={OR:[{atendimentoId:id},...(a.leadId?[{leadId:a.leadId}]:[])]};
   const filtro:Prisma.TarefaWhereInput={AND:[await escopoTarefas(fresco,capacidadesCrm(fresco.papeis).has("tarefas.equipe")),pertence]};
   const tarefa=await tx.tarefa.findFirst({where:{AND:[{id:tid},filtro]}});
   if(!tarefa)throw new ErroRegra("Tarefa não encontrada.");
   return {tx,autor:fresco,tarefa,versao:v,filtro} satisfies ContextoTransicaoTarefa;
  };
  const c=await contexto();
  let mudou:boolean;
  if(entrada.tipo==="concluir")mudou=await concluirTarefaTx(c,null);
  else if(entrada.tipo==="reabrir")mudou=await reabrirTarefaTx(c);
  else if(entrada.tipo==="cancelar")mudou=await cancelarTarefaTx(c,motivo!);
  else {
   if(!q!.dataCivil&&q!.hora)throw new ErroRegra("Informe a data para definir o horário.");
   let inicioEm:Date|null=null;
   if(q!.dataCivil&&q!.hora){const r=instanteDoCampoLocal(q!.dataCivil+"T"+q!.hora,fuso!);if(!r.ok)throw new ErroRegra(r.erro);inicioEm=r.instante;}
   const antecedencia=inicioEm?c.tarefa.lembreteAntecedenciaMin:null;
   // Instante é autoridade. A projeção civil na origem não volta a ser interpretada (dobra DST).
   const dataCivil=inicioEm?valorCampoLocal(inicioEm,c.tarefa.fusoOrigem).slice(0,10):q!.dataCivil;
   mudou=await reagendarTarefaTx(c,{dataCivil,inicioEm,lembreteAntecedenciaMin:antecedencia,lembrarEm:inicioEm&&antecedencia!==null?new Date(inicioEm.getTime()-antecedencia*60000):null});
  }
  if(mudou)await avisarAtendimento(tx,id);
 });
}