import {z} from "zod";
import type {Prisma,Tarefa} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import {ErroRegra,type UsuarioSessao} from "@/server/_shared/sessao";
import {hashEntrada,marcaIdempotencia,repeticaoIdempotente} from "@/server/_shared/idempotencia";
import {ChaveIdempotenciaSchema} from "@/server/_shared/validacao";
import {atendimentoVisivel} from "@/server/whatsapp/atendimentos";
import {nomeDoContato} from "@/server/whatsapp/nome-contato";
import {podeVerLeadNaThread} from "@/server/whatsapp/consultas-inbox";
import {CamposTarefaSchema,escopoTarefas} from "@/server/crm/tarefas";
import {criarTarefaTx,editarTarefaTx,type OpcoesEdicaoTarefaTx} from "@/server/crm/tarefas-escrita";
import {concluirTarefaTx} from "@/server/crm/tarefas-transicoes";
import {listarResponsaveisPossiveis} from "@/server/crm/tarefas-consulta";
import {capacidadesCrm,exigirCapacidadeCrm} from "@/server/crm/permissoes";
import {carregarFusoInstitucionalTx} from "@/server/operacao/relogio";
import {instanteDoCampoLocal,valorCampoLocal} from "@/server/operacao/fuso-entrada";
import {pessoaDoAtendimento} from "./painel-detalhes";
import {avisarAtendimento} from "./aviso";
const Id=z.string().min(1);
const Contexto=z.object({contextoEsperado:z.string().min(1),fusoEscolaEsperado:z.string().min(1)});
const Campos=CamposTarefaSchema.omit({leadId:true,pessoaId:true,alunoId:true,matriculaId:true});
const Criar=Campos.merge(Contexto).extend({vincularOportunidade:z.boolean(),jaFeita:z.boolean().optional(),chaveIdempotencia:ChaveIdempotenciaSchema}).strict();
const Editar=Campos.partial().merge(Contexto).extend({vinculo:z.enum(["manter","vincularAtual","remover"])}).strict();
export type CriarTarefaInboxInput=z.input<typeof Criar>;
export type EditarTarefaInboxInput=z.input<typeof Editar>;
export type TarefaModalSnapshot={id:string;versao:number;titulo:string;tipo:Tarefa["tipo"];descricao:string;prioridade:Tarefa["prioridade"];dataCivil:string|null;hora:string|null;inicioEm:string|null;duracaoMin:15|30|45|60|90;fusoOrigem:string;lembreteAntecedenciaMin:0|10|30|60|null;responsavelId:string|null;leadId:string|null;pessoaId:string|null;podeAlterarVinculo:boolean;vinculadaAtual:boolean};
export type DadosModalTarefa={contatoNome:string;oportunidade:{id:string;titulo:string}|null;responsaveis:{id:string;nome:string}[];podeAtribuirResponsavel:boolean;fusoEscola:string;usuarioId:string;contextoEsperado:string;contextoIdentidadeEsperada:string;tarefa:TarefaModalSnapshot|null};
async function contexto(tx:Prisma.TransactionClient,sessao:UsuarioSessao,id:string){
 const autor=await tx.usuario.findUnique({where:{id:sessao.id},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true}});
 if(!autor?.ativo)throw new ErroRegra("Sua sessão não está mais ativa.");
 exigirCapacidadeCrm(autor,"tarefas.ver");
 const a=await atendimentoVisivel(autor,id,false,tx);if(!a)throw new ErroRegra("Atendimento não encontrado.");
 const visivel=a.finalidade==="COMERCIAL"&&!!a.leadId&&await podeVerLeadNaThread(autor,id,a.leadId,Date.now(),tx);
 const op=visivel?await tx.oportunidade.findUnique({where:{id:a.leadId!},select:{id:true,nome:true,pessoaId:true}}):null;
 const pessoa=await pessoaDoAtendimento(autor,id,tx);
 const contextoIdentidadeEsperada=hashEntrada({atendimentoId:a.id,conversaId:a.conversaId,contatoId:a.contatoId,leadId:a.leadId,pessoaContatoId:a.contato.pessoaId});
 const contextoEsperado=hashEntrada({contextoIdentidadeEsperada,oportunidadeVisivelId:op?.id??null,pessoaId:pessoa?.pessoaId??null});
 const filtro:Prisma.TarefaWhereInput={AND:[await escopoTarefas(autor,capacidadesCrm(autor.papeis).has("tarefas.equipe")),{OR:[{atendimentoId:id},...(a.leadId?[{leadId:a.leadId}]:[])]}]};
 return {autor,a,op,pessoa,contextoEsperado,contextoIdentidadeEsperada,filtro};
}
function conferir(c:{contextoEsperado:string},esperado:string){if(c.contextoEsperado!==esperado)throw new ErroRegra("O contexto da conversa mudou. Reabra o formulário.");}
function conferirFuso(fuso:string|null,esperado:string):asserts fuso is string{if(!fuso||fuso!==esperado)throw new ErroRegra("O fuso da escola mudou ou está indisponível. Reabra o formulário.");}
async function tarefaVisivel(tx:Prisma.TransactionClient,id:string,filtro:Prisma.TarefaWhereInput){const t=await tx.tarefa.findFirst({where:{AND:[{id},filtro]}});if(!t)throw new ErroRegra("Tarefa não encontrada.");return t;}
export async function dadosTarefaModal(sessao:UsuarioSessao,atendimentoId:string,tarefaId?:string):Promise<DadosModalTarefa>{
 const id=Id.parse(atendimentoId);
 return prisma.$transaction(async tx=>{
  const fuso=await carregarFusoInstitucionalTx(tx);if(!fuso)throw new ErroRegra("Configure o fuso institucional da escola antes de criar tarefas.");
  const c=await contexto(tx,sessao,id),t=tarefaId?await tarefaVisivel(tx,Id.parse(tarefaId),c.filtro):null;
  if(t&&t.status!=="ABERTA")throw new ErroRegra("Só tarefas abertas podem ser editadas.");
  const local=t?.inicioEm?valorCampoLocal(t.inicioEm,fuso):null;
  return {contatoNome:nomeDoContato(c.a.contato),oportunidade:c.op?{id:c.op.id,titulo:c.op.nome}:null,responsaveis:await listarResponsaveisPossiveis(c.autor,tx),podeAtribuirResponsavel:capacidadesCrm(c.autor.papeis).has("tarefas.equipe"),fusoEscola:fuso,usuarioId:c.autor.id,contextoEsperado:c.contextoEsperado,contextoIdentidadeEsperada:c.contextoIdentidadeEsperada,
   tarefa:t?{id:t.id,versao:t.versao,titulo:t.titulo,tipo:t.tipo,descricao:t.descricao??"",prioridade:t.prioridade,dataCivil:local?.slice(0,10)??t.dataCivil,hora:local?.slice(11,16)??null,inicioEm:t.inicioEm?.toISOString()??null,duracaoMin:CamposTarefaSchema.shape.duracaoMin.parse(t.duracaoMin)!,fusoOrigem:t.fusoOrigem,lembreteAntecedenciaMin:CamposTarefaSchema.shape.lembreteAntecedenciaMin.parse(t.lembreteAntecedenciaMin)??null,responsavelId:t.responsavelId,leadId:t.leadId,pessoaId:t.pessoaId,podeAlterarVinculo:!!c.op&&(!t.leadId||t.leadId===c.op.id),vinculadaAtual:!!c.op&&t.leadId===c.op.id}:null};
 });
}
export async function criarTarefaInbox(sessao:UsuarioSessao,atendimentoId:string,input:CriarTarefaInboxInput):Promise<{id:string}>{
 const id=Id.parse(atendimentoId),i=Criar.parse(input),{chaveIdempotencia,jaFeita=false,vincularOportunidade,contextoEsperado,fusoEscolaEsperado,...campos}=i;
 const marca=marcaIdempotencia(chaveIdempotencia,{operacao:"criarTarefaNoInbox",atendimentoId:id,campos,jaFeita,vincularOportunidade,contextoEsperado,fusoEscolaEsperado})!;
 return prisma.$transaction(async tx=>{
  // Mesma chave/autor do CRM: advisory sempre antes de Config/Atendimento/FKs.
  const repetido=await repeticaoIdempotente(tx,{tipo:"TarefaCriada",agregadoTipo:"Tarefa",autorId:sessao.id,marca,mensagemConflito:"Esta tentativa já foi usada com outros dados. Reabra o formulário."});
  const fuso=await carregarFusoInstitucionalTx(tx);
  await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${id} FOR UPDATE`;
  if(repetido)await tx.$queryRaw`SELECT id FROM "Tarefa" WHERE id=${repetido.agregadoId} FOR UPDATE`;
  const c=await contexto(tx,sessao,id);conferir(c,contextoEsperado);conferirFuso(fuso,fusoEscolaEsperado);
  if(repetido){await tarefaVisivel(tx,repetido.agregadoId,c.filtro);return {id:repetido.agregadoId};}
  if(vincularOportunidade&&!c.op)throw new ErroRegra("A oportunidade atual não está disponível para vínculo.");
  const t=await criarTarefaTx(tx,c.autor,{...campos,atendimentoId:id,leadId:vincularOportunidade?c.op!.id:undefined,pessoaId:c.pessoa?.pessoaId},fuso,marca);
  if(jaFeita)await concluirTarefaTx({tx,autor:c.autor,tarefa:t,versao:t.versao,filtro:c.filtro},null);
  await avisarAtendimento(tx,id);return {id:t.id};
 });
}
export async function editarTarefaInbox(sessao:UsuarioSessao,atendimentoId:string,tarefaId:string,versao:number,input:EditarTarefaInboxInput):Promise<void>{
 const id=Id.parse(atendimentoId),tid=Id.parse(tarefaId),v=z.number().int().positive().parse(versao),i=Editar.parse(input);
 await prisma.$transaction(async tx=>{
  const fuso=await carregarFusoInstitucionalTx(tx);
  await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${id} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Tarefa" WHERE id=${tid} FOR UPDATE`;
  const c=await contexto(tx,sessao,id);conferir({contextoEsperado:i.vinculo==="manter"?c.contextoIdentidadeEsperada:c.contextoEsperado},i.contextoEsperado);conferirFuso(fuso,i.fusoEscolaEsperado);
  const t=await tarefaVisivel(tx,tid,c.filtro),opcoes:OpcoesEdicaoTarefaTx={filtro:c.filtro};
  if(i.vinculo!=="manter"){
   if(!c.op||t.leadId&&t.leadId!==c.op.id||i.vinculo==="remover"&&t.leadId!==c.op.id)throw new ErroRegra("Este vínculo não pertence à oportunidade atual.");
   const pessoaAtual=c.pessoa?.leadId===c.op.id?c.pessoa.pessoaId:null;
   if(i.vinculo==="vincularAtual"&&t.pessoaId&&t.pessoaId!==pessoaAtual)throw new ErroRegra("A Pessoa da tarefa é incompatível com a oportunidade atual.");
   opcoes.vinculo={leadId:i.vinculo==="remover"?null:c.op.id,pessoaId:i.vinculo==="remover"?t.pessoaId:t.pessoaId??pessoaAtual};
  }
  const d=Campos.partial().parse(i);
  if(d.dataCivil!==undefined||d.hora!==undefined||d.lembreteAntecedenciaMin!==undefined){
   const local=t.inicioEm?valorCampoLocal(t.inicioEm,fuso):null;
   const data=d.dataCivil!==undefined?d.dataCivil:local?.slice(0,10)??t.dataCivil,hora=d.hora!==undefined?d.hora:local?.slice(11,16)??null,antecedencia=d.lembreteAntecedenciaMin!==undefined?d.lembreteAntecedenciaMin:t.lembreteAntecedenciaMin;
   if(!data&&hora)throw new ErroRegra("Informe a data para definir o horário.");
   if(antecedencia!==null&&!(data&&hora))throw new ErroRegra("O lembrete exige data e horário.");
   let inicioEm:Date|null=null;if(data&&hora){const r=instanteDoCampoLocal(data+"T"+hora,fuso);if(!r.ok)throw new ErroRegra(r.erro);inicioEm=r.instante;}
   opcoes.agendamento={dataCivil:inicioEm?valorCampoLocal(inicioEm,t.fusoOrigem).slice(0,10):data,inicioEm,lembreteAntecedenciaMin:antecedencia,lembrarEm:inicioEm&&antecedencia!==null?new Date(inicioEm.getTime()-antecedencia*60000):null};
   delete d.dataCivil;delete d.hora;delete d.lembreteAntecedenciaMin;
  }
  await editarTarefaTx(tx,c.autor,t,v,d,opcoes);await avisarAtendimento(tx,id);
 });
}
