import { candidatoPodeLerTarefaD10 } from "./tarefa-notificados-regras";
import { ErroPermissao, type UsuarioSessao } from "@/server/_shared/sessao";
import { z } from "zod";
import { FinalidadeAtendimentoWhatsApp, PrioridadeTarefa, TipoTarefa, type Prisma, type Tarefa } from "@prisma/client";
import { ErroRegra } from "@/server/_shared/sessao";
import { DataCivilSchema } from "@/server/matricula/cobertura";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { LembreteTarefaD10Schema } from "./tarefa-d10-schema";
const id=z.string().min(1).nullable();
export const SnapshotRecorrenciaTarefaSchema=z.object({
 versao:z.literal(1),recorrencia:z.enum(["DIARIA","SEMANAL","MENSAL"]),indiceAtual:z.number().int().nonnegative(),
 ancora:z.object({dataCivil:DataCivilSchema,hora:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),fusoOrigem:FusoInstitucionalSchema}).strict(),
 dados:z.object({titulo:z.string().min(1).max(200),descricao:z.string().nullable(),tipo:z.nativeEnum(TipoTarefa),setor:z.nativeEnum(FinalidadeAtendimentoWhatsApp),prioridade:z.nativeEnum(PrioridadeTarefa),duracaoMin:z.number().int().positive().max(1440),lembreteAntecedenciaMin:LembreteTarefaD10Schema,responsavelId:id,criadorId:id,leadId:id,pessoaId:id,alunoId:id,matriculaId:id,atendimentoId:id}).strict(),
 notificarUsuarioIds:z.array(z.string().min(1)).max(200).transform(ids=>[...new Set(ids)].sort()),
}).strict();
export type SnapshotRecorrenciaTarefa=z.infer<typeof SnapshotRecorrenciaTarefaSchema>;
export async function criarIntencaoRecorrenciaTx(tx:Prisma.TransactionClient,t:Tarefa,corteEm:Date,conclusaoVersao:number):Promise<string|null>{
 if(t.recorrencia==="NAO_REPETE")return null;
 if(!Number.isFinite(corteEm.getTime())||t.recorrenciaPoliticaVersao!==1)throw new ErroRegra("Configuração de recorrência inválida.");
 if(await tx.tarefa.findUnique({where:{recorrenciaAnteriorId:t.id},select:{id:true}}))return null;
 const anterior=await tx.intencaoRecorrenciaTarefa.findUnique({where:{tarefaId_conclusaoVersao:{tarefaId:t.id,conclusaoVersao}},select:{id:true}});
 if(anterior)return anterior.id;
 const membros=await tx.tarefaNotificado.findMany({where:{tarefaId:t.id},select:{usuarioId:true}});
 const parsed=SnapshotRecorrenciaTarefaSchema.safeParse({versao:1,recorrencia:t.recorrencia,indiceAtual:t.recorrenciaIndice,ancora:{dataCivil:t.recorrenciaAncoraDataCivil,hora:t.recorrenciaAncoraHora,fusoOrigem:t.recorrenciaAncoraFuso},dados:{titulo:t.titulo,descricao:t.descricao,tipo:t.tipo,setor:t.setor,prioridade:t.prioridade,duracaoMin:t.duracaoMin,lembreteAntecedenciaMin:t.lembreteAntecedenciaMin,responsavelId:t.responsavelId,criadorId:t.criadorId,leadId:t.leadId,pessoaId:t.pessoaId,alunoId:t.alunoId,matriculaId:t.matriculaId,atendimentoId:t.atendimentoId},notificarUsuarioIds:membros.map(m=>m.usuarioId)});
 if(!parsed.success)throw new ErroRegra("Configuração de recorrência inválida.");
 const i=await tx.intencaoRecorrenciaTarefa.create({data:{tarefaId:t.id,conclusaoVersao,corteEm:new Date(corteEm.getTime()),snapshot:parsed.data}});
 return i.id;
}
export async function cancelarIntencaoRecorrenciaTx(tx:Prisma.TransactionClient,tarefaId:string):Promise<number>{
 const r=await tx.intencaoRecorrenciaTarefa.updateMany({where:{tarefaId,estado:"PENDENTE"},data:{estado:"CANCELADA_REABERTURA",versao:{increment:1}}});
 return r.count;
}
/** Última consulta de autoridade do autor humano; não reutiliza papéis capturados. */
export async function conferirAutorRecorrenciaTx(tx:Prisma.TransactionClient,autor:UsuarioSessao,t:Tarefa):Promise<void>{
 const ids=[...new Set([autor.id,...(t.responsavelId?[t.responsavelId]:[])])];
 const rows=await tx.usuario.findMany({where:{id:{in:ids}}});
 const atual=rows.find(u=>u.id===autor.id),dono=t.responsavelId?rows.find(u=>u.id===t.responsavelId):null;
 if(!atual||!candidatoPodeLerTarefaD10(atual,{responsavelId:t.responsavelId,setor:t.setor,gerenteDoResponsavelId:dono?.gerenteComercialId??null}))throw new ErroPermissao();
}