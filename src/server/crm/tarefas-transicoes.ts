import { criarIntencaoRecorrenciaTx, cancelarIntencaoRecorrenciaTx, conferirAutorRecorrenciaTx } from "./tarefa-recorrencia-intencao";
import type { Prisma, Tarefa, TipoTarefa } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { ErroRegra } from "@/server/_shared/sessao";
import { registrarEvento } from "@/server/_shared/evento";
import { ultimoEventoDoAutor } from "@/server/_shared/idempotencia";
import type { DecisaoMensagemAgendada } from "@/lib/selo-mensagem-agendada";
import { cancelarMensagensAgendadasDaTarefaTx, decisaoCancelaMensagem } from "@/server/inbox/mensagem-agendada-tarefa";

export const MSG_VERSAO_TAREFA = "Esta tarefa foi alterada por outra pessoa. Recarregue.";
export type ContextoTransicaoTarefa = { tx: Prisma.TransactionClient; autor: UsuarioSessao; tarefa: Tarefa; versao: number; filtro?: Prisma.TarefaWhereInput };
async function gravar(c: ContextoTransicaoTarefa, status: "ABERTA" | "CONCLUIDA", data: Prisma.TarefaUncheckedUpdateManyInput) {
 const r = await c.tx.tarefa.updateMany({where:{AND:[{id:c.tarefa.id,versao:c.versao,status},c.filtro ?? {}]},data:{...data,versao:{increment:1}}});
 if (!r.count) throw new ErroRegra(MSG_VERSAO_TAREFA);
}
const CANAL_POR_TIPO: Partial<Record<TipoTarefa,string>> = {WHATSAPP:"WHATSAPP",LIGACAO:"LIGACAO",EMAIL:"EMAIL",REUNIAO:"PRESENCIAL"};
export async function concluirTarefaTx(c: ContextoTransicaoTarefa, texto: string | null, mensagemAgendada?: DecisaoMensagemAgendada): Promise<boolean> {
 const {tx,autor,tarefa:t}=c;
 if(t.status!=="ABERTA")throw new ErroRegra("Só tarefas abertas podem ser concluídas.");
 const corteEm=new Date();
 await gravar(c,"ABERTA",{status:"CONCLUIDA",concluidaEm:corteEm,concluidaPorId:autor.id,resultado:texto});
 await registrarEvento(tx,{tipo:"TarefaConcluida",agregadoTipo:"Tarefa",agregadoId:t.id,autorId:autor.id,payload:{resultado:texto}});
 if(t.leadId)await registrarEvento(tx,{tipo:"TarefaConcluida",agregadoTipo:"Lead",agregadoId:t.leadId,autorId:autor.id,payload:{tarefaId:t.id,titulo:t.titulo,resultado:texto}});
 const canal=CANAL_POR_TIPO[t.tipo];
 if(t.leadId&&texto&&canal)await registrarEvento(tx,{tipo:"InteracaoRegistrada",agregadoTipo:"Lead",agregadoId:t.leadId,autorId:autor.id,payload:{canal,nota:texto,resultado:texto,tarefaId:t.id}});
 if(t.recorrencia!=="NAO_REPETE"){await criarIntencaoRecorrenciaTx(tx,t,corteEm,c.versao+1);await conferirAutorRecorrenciaTx(tx,autor,t);}
 if(decisaoCancelaMensagem(mensagemAgendada))await cancelarMensagensAgendadasDaTarefaTx(tx,autor.id,t.id);
 return true;
}
export async function reabrirTarefaTx(c: ContextoTransicaoTarefa): Promise<boolean> {
 const {tx,autor,tarefa:t}=c;
 if(t.status!=="CONCLUIDA")throw new ErroRegra("Só tarefas concluídas podem ser reabertas.");
 await gravar(c,"CONCLUIDA",{status:"ABERTA",concluidaEm:null,concluidaPorId:null,resultado:null});
 if(t.recorrencia!=="NAO_REPETE")await cancelarIntencaoRecorrenciaTx(tx,t.id);
 await registrarEvento(tx,{tipo:"TarefaReaberta",agregadoTipo:"Tarefa",agregadoId:t.id,autorId:autor.id,payload:{resultadoAnterior:t.resultado}});
 if(t.recorrencia!=="NAO_REPETE")await conferirAutorRecorrenciaTx(tx,autor,t);
 return true;
}
export type AgendamentoTarefaResolvido = { dataCivil: string | null; inicioEm: Date | null; lembrarEm: Date | null; lembreteAntecedenciaMin: number | null };
export async function reagendarTarefaTx(c: ContextoTransicaoTarefa, novo: AgendamentoTarefaResolvido): Promise<boolean> {
 const {tx,autor,tarefa:t}=c;
 if(t.status!=="ABERTA")throw new ErroRegra("Só tarefas abertas podem ser reagendadas.");
 await gravar(c,"ABERTA",{...novo,lembreteDisparadoEm:null});
 await registrarEvento(tx,{tipo:"TarefaReagendada",agregadoTipo:"Tarefa",agregadoId:t.id,autorId:autor.id,payload:{de:{dataCivil:t.dataCivil,inicioEm:t.inicioEm?.toISOString()??null},para:{dataCivil:novo.dataCivil,inicioEm:novo.inicioEm?.toISOString()??null}}});
 return true;
}
export async function cancelarTarefaTx(c: ContextoTransicaoTarefa, motivo: string, mensagemAgendada?: DecisaoMensagemAgendada): Promise<boolean> {
 const {tx,autor,tarefa:t}=c;
 if(t.status==="CANCELADA"&&t.motivoCancelamento===motivo){
  const p=await ultimoEventoDoAutor(tx,{tipo:"TarefaCancelada",agregadoTipo:"Tarefa",agregadoId:t.id,autorId:autor.id});
  if(p?.motivo===motivo)return false;
 }
 if(t.status!=="ABERTA")throw new ErroRegra("Só tarefas abertas podem ser canceladas.");
 await gravar(c,"ABERTA",{status:"CANCELADA",canceladaEm:new Date(),motivoCancelamento:motivo,lembrarEm:null});
 await registrarEvento(tx,{tipo:"TarefaCancelada",agregadoTipo:"Tarefa",agregadoId:t.id,autorId:autor.id,payload:{motivo}});
 if(decisaoCancelaMensagem(mensagemAgendada))await cancelarMensagensAgendadasDaTarefaTx(tx,autor.id,t.id);
 return true;
}