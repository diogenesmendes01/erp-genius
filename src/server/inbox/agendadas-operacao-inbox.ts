import type {Prisma,PrismaClient,IntencaoMensagem,TipoMensagem} from "@prisma/client";
import {z} from "zod";
import {ErroRegra,apenasPortal} from "@/server/_shared/sessao";
import {ChaveIdempotenciaSchema} from "@/server/_shared/validacao";
import {marcaIdempotencia,repeticaoIdempotente} from "@/server/_shared/idempotencia";
import {registrarEvento} from "@/server/_shared/evento";
import {AgendarSchema,InstanteSchema,LegendaAgendadaSchema,futuro,dataFutura,nomeAnexoCurto} from "@/server/crm/mensagens-agendadas-regras";
import {capacidadesCrm} from "@/server/crm/permissoes";
import {escopoTarefas} from "@/server/crm/tarefas";
import {contentTypePorExtensao} from "@/lib/uploads";
import {copiarDocumentoParaSaida,descartarMidiaSaida,midiaSaidaDoAutor,midiaSaidaExiste,tipoPorMime} from "@/server/whatsapp/midia";
import {podeVerLeadNaThread} from "@/server/whatsapp/visibilidade-lead";
import {ERRO_ANEXAR_PROPOSTA,exigirPropostaVisivel} from "@/server/whatsapp/proposta-atendimento";
import {atendimentoVisivel} from "@/server/whatsapp/atendimentos";
import {lerContextoAtualInbox} from "@/server/whatsapp/enfileirar-inbox";
import {exigirAgendamentoNaJanela} from "@/server/whatsapp/janela-agendamento";
import {derivarEstadoAria,linhaEstadoDe} from "./estado-aria";
import {podeAlterarAgendadaNoInbox} from "./agendadas-policy";
import {MOTIVO_AGUARDA_CONFIRMACAO} from "@/server/crm/mensagens-agendadas-regras";
export type ComandoAgendadaInbox=
 |{tipo:"CRIAR";atendimentoId:string;texto:string;agendadaPara:string;validaAte?:string;numeroEsperado?:string;perguntarSeResponder?:boolean;midiaUrl?:string;documentoPropostaId?:string;anexoNome?:string;leadId?:string;tarefaId?:string;chaveIdempotencia?:string}
 |{tipo:"REAGENDAR";atendimentoId:string;intencaoId:string;agendadaPara:string;chaveIdempotencia?:string}
 |{tipo:"ENVIAR_AGORA";atendimentoId:string;intencaoId:string;chaveIdempotencia?:string}
 |{tipo:"EDITAR";atendimentoId:string;intencaoId:string;texto:string;agendadaPara:string;chaveIdempotencia?:string}
 |{tipo:"MANTER";atendimentoId:string;intencaoId:string;chaveIdempotencia?:string};
export type BancoAgendadaInbox=Pick<PrismaClient,"$transaction">;
type Tx=Prisma.TransactionClient;
type Atendimento=NonNullable<Awaited<ReturnType<typeof atendimentoVisivel>>>;
type Alvo=Pick<IntencaoMensagem,"id"|"atendimentoId"|"numeroId"|"contatoId"|"origem"|"autorId"|"status"|"agendadaPara"|"validaAte"|"passo"|"passoComercial"|"corpoRenderizado"|"tipo"|"templateId"|"midiaPath"|"conteudo"|"perguntarSeResponder"|"motivoFalha">;
const semAlvo=()=>new ErroRegra("Mensagem não encontrada ou mudou de situação.");
const assumir=(tipo:ComandoAgendadaInbox["tipo"])=>new ErroRegra(tipo==="CRIAR"?"Assuma a conversa para agendar a mensagem.":"Assuma a conversa para alterar a mensagem agendada.");
function binding(a:Atendimento){const c=a.conversa.contato;return JSON.stringify([
 a.id,a.finalidade,a.numeroId,a.conversaId,a.contatoId,a.leadId??null,a.alunoId??null,a.matriculaId??null,a.turmaId??null,a.autorizacaoComunicacaoAcademicaId??null,
 a.conversa.id,a.conversa.grupoId,c.id,c.pessoaId??null,c.leadId??null,c.alunoId??null,c.responsavelId??null,c.telefoneE164??null,
]);}
const selecionarAtor={id:true,nome:true,papeis:true,permissoes:true,ativo:true,gerenteComercialId:true} as const;
async function gate(tx:Tx,autorId:string,id:string,numeroId:string,tipo:ComandoAgendadaInbox["tipo"],alvo?:string,m?:Alvo){
 const u=await tx.usuario.findUnique({where:{id:autorId},select:selecionarAtor});
 if(!u?.ativo||apenasPortal(u))throw new ErroRegra("Sua sessão não está mais ativa.");
 const {ctx,sugestao}=await lerContextoAtualInbox(tx,id);
 const a=await atendimentoVisivel(u,id,true,tx);
 if(!a||a.encerradoEm||(alvo!==undefined&&binding(a)!==alvo))throw new ErroRegra("Atendimento não encontrado.");
 if(a.numeroId!==numeroId||!a.numero.ativo)throw new ErroRegra("Número de envio indisponível.");
 if(a.contato.optOutEm)throw new ErroRegra("Contato pediu para não receber mensagens.");
 const estado=derivarEstadoAria(linhaEstadoDe(a),ctx,sugestao);
 if(a.responsavelId!==autorId||estado==="ia"||estado==="aprovacao"||estado==="handoff")throw assumir(tipo);
 const usuarios=await tx.usuario.findMany({where:{id:{in:[...new Set([autorId,...(m?.autorId?[m.autorId]:[])])]}},select:selecionarAtor});
 const ultimo=usuarios.find(x=>x.id===autorId);
 const perfil=(x:typeof u)=>JSON.stringify([x.id,[...x.papeis].sort(),[...x.permissoes].sort()]);
 if(!ultimo?.ativo||apenasPortal(ultimo)||perfil(ultimo)!==perfil(u))throw new ErroRegra("Sua sessão ou acesso mudou. Atualize o atendimento.");
 if(m){
  if(m.numeroId!==a.numeroId||m.contatoId!==a.contatoId)throw semAlvo();
  const gerente=m.autorId?usuarios.find(x=>x.id===m.autorId)?.gerenteComercialId??null:null;
  if(!podeAlterarAgendadaNoInbox(ultimo,{...m,autorGerenteComercialId:gerente},{id:a.id,responsavelId:a.responsavelId,encerradoEm:a.encerradoEm,autorizadoEnviar:true,estadoAria:estado,numeroAtivo:a.numero.ativo,optOut:a.contato.optOutEm!==null}))throw semAlvo();
 }
 return a;
}
export async function podeCriarAgendadaInboxTx(tx:Tx,autorId:string,atendimentoId:string):Promise<boolean>{
 const r=await tx.atendimentoWhatsApp.findUnique({where:{id:atendimentoId},select:{conversa:{select:{numeroId:true}}}});
 if(!r)return false;
 try{await gate(tx,autorId,atendimentoId,r.conversa.numeroId,"CRIAR");return true;}
 catch(e){if(e instanceof ErroRegra)return false;throw e;}
}
export function naTransacaoAtual(tx:Tx):BancoAgendadaInbox{
 return {$transaction:((fn:(t:Tx)=>Promise<unknown>)=>fn(tx)) as BancoAgendadaInbox["$transaction"]};
}
async function conferirLeituraRecibo(tx:Tx,autorId:string,atendimentoId:string){
 const u=await tx.usuario.findUnique({where:{id:autorId},select:selecionarAtor});
 if(!u?.ativo||apenasPortal(u))throw new ErroRegra("Sua sessão não está mais ativa.");
 const perfil=(x:typeof u)=>JSON.stringify([x.id,[...x.papeis].sort(),[...x.permissoes].sort(),x.gerenteComercialId]);
 const antes=perfil(u);
 if(!await atendimentoVisivel(u,atendimentoId,false,tx))throw new ErroRegra("Atendimento não encontrado.");
 const usuarios=await tx.usuario.findMany({where:{id:autorId},select:selecionarAtor});
 const ultimo=usuarios.find(x=>x.id===autorId);
 if(!ultimo?.ativo||apenasPortal(ultimo)||perfil(ultimo)!==antes)throw new ErroRegra("Sua sessão ou acesso mudou. Atualize o atendimento.");
}
export async function executarAgendadaInbox(db:BancoAgendadaInbox,autorId:string,comando:ComandoAgendadaInbox):Promise<{id:string}>{
 z.string().min(1).parse(autorId);z.string().min(1).parse(comando.atendimentoId);
 ChaveIdempotenciaSchema.optional().parse(comando.chaveIdempotencia);
 const c=comando.tipo==="CRIAR"?{...comando,...AgendarSchema.parse({...comando,anexoNome:nomeAnexoCurto(comando.anexoNome),numeroId:comando.numeroEsperado??"resolvido-no-servidor"})}:comando;
 if(c.tipo!=="CRIAR")z.string().min(1).parse(c.intencaoId);
 if(c.tipo==="REAGENDAR"||c.tipo==="EDITAR")InstanteSchema.parse(c.agendadaPara);
 const texto=c.tipo==="EDITAR"?LegendaAgendadaSchema.parse(c.texto):null;
 let copiada:string|null=null;
 try{return await db.$transaction(async tx=>{
  const resolvido=await tx.atendimentoWhatsApp.findUnique({where:{id:c.atendimentoId},select:{conversa:{select:{numeroId:true}}}});
  if(!resolvido)throw new ErroRegra("Atendimento não encontrado.");
  const numeroId=resolvido.conversa.numeroId;
  const tipoEvento=c.tipo==="CRIAR"?"MensagemAgendada":c.tipo==="EDITAR"?"MensagemAgendadaEditada":c.tipo==="MANTER"?"MensagemAgendadaMantida":"MensagemReagendada";
  const entrada=c.tipo==="CRIAR"?{atendimentoId:c.atendimentoId,numeroId,texto:c.texto,agendadaPara:new Date(c.agendadaPara).toISOString(),validaAte:c.validaAte?new Date(c.validaAte).toISOString():null,...(c.perguntarSeResponder?{perguntarSeResponder:true}:{}),...(c.midiaUrl?{midiaUrl:c.midiaUrl}:{}),...(c.documentoPropostaId?{documentoPropostaId:c.documentoPropostaId}:{}),...(c.leadId?{leadId:c.leadId}:{}),...(c.tarefaId?{tarefaId:c.tarefaId}:{})}:
   {contexto:"inbox362",operacao:c.tipo,atendimentoId:c.atendimentoId,intencaoId:c.intencaoId,...(c.tipo==="REAGENDAR"||c.tipo==="EDITAR"?{agendadaPara:new Date(c.agendadaPara).toISOString()}:{}),...(c.tipo==="EDITAR"?{texto}:{})};
  const marca=marcaIdempotencia(c.chaveIdempotencia,entrada);
  const replay=marca?await repeticaoIdempotente(tx,{tipo:tipoEvento,agregadoTipo:"AtendimentoWhatsApp",autorId,marca,mensagemConflito:"Esta tentativa já foi usada com outra mensagem, operação ou horário."}):null;
  if(replay){
   const recibo=(replay.payload??{}) as Record<string,unknown>;
   if(replay.tipo!==tipoEvento||replay.agregadoTipo!=="AtendimentoWhatsApp"||replay.agregadoId!==c.atendimentoId||replay.autorId!==autorId||typeof recibo.intencaoId!=="string")throw semAlvo();
   if(recibo.atendimentoId!==undefined&&recibo.atendimentoId!==c.atendimentoId)throw semAlvo();
   if(c.tipo!=="CRIAR"&&(recibo.contexto!=="inbox362"||recibo.operacao!==c.tipo||recibo.intencaoId!==c.intencaoId))throw semAlvo();
   if(c.tipo==="CRIAR"&&((recibo.contexto!==undefined&&recibo.contexto!=="inbox362")||(recibo.operacao!==undefined&&recibo.operacao!=="CRIAR")))throw semAlvo();
   await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${c.atendimentoId} FOR SHARE`;
   const id=recibo.intencaoId;
   await tx.$queryRaw`SELECT id FROM "IntencaoMensagem" WHERE id=${id} AND "atendimentoId"=${c.atendimentoId} FOR UPDATE`;
   const confirmada=await tx.intencaoMensagem.findFirst({where:{id,atendimentoId:c.atendimentoId}});
   if(!confirmada||confirmada.id!==id||confirmada.atendimentoId!==c.atendimentoId||confirmada.origem!=="HUMANO"||confirmada.passo!==null||confirmada.passoComercial!==null)throw semAlvo();
   if(recibo.numeroId!==undefined&&recibo.numeroId!==confirmada.numeroId)throw semAlvo();
   await conferirLeituraRecibo(tx,autorId,c.atendimentoId);
   return {id:confirmada.id};
  }
  await tx.configIA.upsert({where:{id:"ia"},create:{id:"ia"},update:{}});
  await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${c.atendimentoId} FOR SHARE`;
  const inicial=await gate(tx,autorId,c.atendimentoId,numeroId,c.tipo);
  if(c.tipo==="CRIAR"&&c.numeroEsperado!==undefined&&c.numeroEsperado!==numeroId)throw new ErroRegra("Número de envio indisponível.");
  const alvo=binding(inicial);
  const id=c.tipo==="CRIAR"?null:c.intencaoId;
  let m:Alvo|null=null;
  if(id){
   await tx.$queryRaw`SELECT id FROM "IntencaoMensagem" WHERE id=${id} AND "atendimentoId"=${c.atendimentoId}
    AND origem='HUMANO' AND "agendadaPara" IS NOT NULL AND passo IS NULL AND "passoComercial" IS NULL FOR UPDATE`;
   m=await tx.intencaoMensagem.findFirst({where:{id,atendimentoId:c.atendimentoId,origem:"HUMANO",agendadaPara:{not:null},passo:null,passoComercial:null}});
   if(m&&c.tipo==="EDITAR"&&m.status!=="PENDENTE"&&m.status!=="ADIADA"){
    await gate(tx,autorId,c.atendimentoId,numeroId,c.tipo,alvo,{...m,status:"PENDENTE"});
    if(m.status==="ENVIANDO")throw new ErroRegra("A mensagem já está sendo enviada.");
    if(m.status==="DESPACHADA"||m.status==="SIMULADA")throw new ErroRegra("A mensagem já foi enviada.");
   }
   if(!m||(m.status!=="PENDENTE"&&m.status!=="ADIADA")||(c.tipo==="CRIAR"&&m.autorId!==autorId))throw semAlvo();
  }
  await gate(tx,autorId,c.atendimentoId,numeroId,c.tipo,alvo,m??undefined);
  if(c.tipo==="EDITAR"){
   if(!m||m.templateId!=null||m.conteudo!=null||(m.tipo==="TEXTO")!==(m.midiaPath==null))throw new ErroRegra("Só mensagens de texto podem ter o texto editado.");
   if(!texto&&m.midiaPath==null)throw new ErroRegra("Escreva a mensagem.");
  }
  if(c.tipo==="MANTER"){
   if(!m)throw semAlvo();
   if(!m.perguntarSeResponder)throw new ErroRegra("Esta mensagem não aguarda confirmação.");
   const agora=new Date();
   const r=await tx.intencaoMensagem.updateMany({where:{id:m.id,atendimentoId:c.atendimentoId,numeroId:m.numeroId,contatoId:m.contatoId,autorId:m.autorId,origem:"HUMANO",status:m.status,agendadaPara:m.agendadaPara,passo:null,passoComercial:null},
    data:{confirmadaAposRespostaEm:agora,...(m.status==="ADIADA"&&m.motivoFalha===MOTIVO_AGUARDA_CONFIRMACAO?{status:"PENDENTE",despacharAposEm:null,motivoFalha:null}:{})}});
   if(r.count!==1)throw semAlvo();
   await registrarEvento(tx,{tipo:tipoEvento,agregadoTipo:"AtendimentoWhatsApp",agregadoId:c.atendimentoId,autorId,payload:{contexto:"inbox362",operacao:c.tipo,intencaoId:m.id,atendimentoId:c.atendimentoId,agendadaPara:m.agendadaPara!.toISOString(),numeroId,...marca}});
   await gate(tx,autorId,c.atendimentoId,numeroId,c.tipo,alvo,m);
   return {id:m.id};
  }
  const quando=c.tipo==="ENVIAR_AGORA"?new Date():futuro(c.agendadaPara);
  const validaAte=c.tipo==="CRIAR"?(c.validaAte?new Date(c.validaAte):null):m?.validaAte??null;
  if(c.tipo==="CRIAR"){if(validaAte&&validaAte.getTime()<=quando.getTime())throw new ErroRegra("A validade deve ser depois do horário agendado.");}
  else {if(!m)throw semAlvo();dataFutura(m,quando);}
  if(c.tipo!=="ENVIAR_AGORA")await exigirAgendamentoNaJanela(quando,tx);
  let anexo:{midiaPath:string;tipo:TipoMensagem;nome:string|null}|null=null;
  if(c.tipo==="CRIAR"){
   const oportunidade=inicial.leadId??inicial.conversa.contato.leadId??null,pessoaId=inicial.conversa.contato.pessoaId??null;
   const ator=c.leadId||c.tarefaId||c.documentoPropostaId?await tx.usuario.findUnique({where:{id:autorId},select:selecionarAtor}):null;
   if(c.leadId&&(c.leadId!==oportunidade||inicial.finalidade!=="COMERCIAL"||!ator||!await podeVerLeadNaThread(ator,c.atendimentoId,c.leadId,Date.now(),tx)))throw new ErroRegra("Oportunidade não é desta conversa.");
   if(c.tarefaId){
    const ligacoes:Prisma.TarefaWhereInput[]=[...(oportunidade?[{leadId:oportunidade}]:[]),...(pessoaId?[{pessoaId}]:[])];
    const t=ator&&ligacoes.length?await tx.tarefa.findFirst({where:{AND:[{id:c.tarefaId,status:"ABERTA"},await escopoTarefas(ator,capacidadesCrm(ator.papeis).has("tarefas.equipe")),{OR:ligacoes}]},select:{id:true}}):null;
    if(!t)throw new ErroRegra("Tarefa não encontrada ou já concluída.");
   }
   if(c.midiaUrl){
    if(!midiaSaidaDoAutor(c.midiaUrl,autorId)||!await midiaSaidaExiste(autorId,c.midiaUrl))throw new ErroRegra("Anexo inválido: envie o arquivo pelo uploader da inbox.");
    anexo={midiaPath:c.midiaUrl,tipo:tipoAnexo(c.midiaUrl),nome:c.anexoNome||null};
   }
   if(c.documentoPropostaId){
    if(!ator)throw new ErroRegra("Sua sessão não está mais ativa.");
    const proposta=await exigirPropostaVisivel(ator,c.atendimentoId,c.documentoPropostaId);
    copiada=await copiarDocumentoParaSaida(autorId,proposta.url);
    if(!copiada)throw new ErroRegra(ERRO_ANEXAR_PROPOSTA);
    anexo={midiaPath:copiada,tipo:tipoAnexo(copiada),nome:proposta.nome};
   }
  }
  await gate(tx,autorId,c.atendimentoId,numeroId,c.tipo,alvo,m??undefined);
  let resultadoId:string;
  if(c.tipo==="CRIAR"){
   const nova=await tx.intencaoMensagem.create({data:{numeroId,atendimentoId:c.atendimentoId,contatoId:inicial.contatoId,origem:"HUMANO",tipo:anexo?.tipo??"TEXTO",midiaPath:anexo?.midiaPath??null,corpoRenderizado:c.texto,agendadaPara:quando,validaAte,perguntarSeResponder:c.perguntarSeResponder===true,leadId:c.leadId??null,tarefaId:c.tarefaId??null,autorId}});
   resultadoId=nova.id;
  }else{
   if(!m)throw semAlvo();
   const r=await tx.intencaoMensagem.updateMany({where:{id:m.id,atendimentoId:c.atendimentoId,numeroId:m.numeroId,contatoId:m.contatoId,autorId:m.autorId,origem:"HUMANO",status:m.status,agendadaPara:m.agendadaPara,passo:null,passoComercial:null},data:{agendadaPara:quando,status:"PENDENTE",despacharAposEm:null,motivoFalha:null,confirmadaAposRespostaEm:new Date(),...(c.tipo==="EDITAR"?{corpoRenderizado:texto!}:{})}});
   if(r.count!==1)throw semAlvo();resultadoId=m.id;
  }
  await registrarEvento(tx,{tipo:tipoEvento,agregadoTipo:"AtendimentoWhatsApp",agregadoId:c.atendimentoId,autorId,payload:{contexto:"inbox362",operacao:c.tipo,intencaoId:resultadoId,atendimentoId:c.atendimentoId,agendadaPara:quando.toISOString(),numeroId,...marca,...(c.tipo==="ENVIAR_AGORA"?{enviarAgora:true}:{}),...(c.tipo==="EDITAR"?{textoAlterado:texto!==m?.corpoRenderizado}:{}),...(c.tipo==="CRIAR"?{...(c.leadId?{leadId:c.leadId}:{}),...(c.tarefaId?{tarefaId:c.tarefaId}:{}),...(anexo?{anexoTipo:anexo.tipo,...(anexo.nome?{anexoNome:anexo.nome}:{}),...(c.documentoPropostaId?{documentoPropostaId:c.documentoPropostaId}:{})}:{})}:{})}});
  await gate(tx,autorId,c.atendimentoId,numeroId,c.tipo,alvo,m??undefined);
  return {id:resultadoId};
 });}catch(e){if(copiada)await descartarMidiaSaida(autorId,copiada);throw e;}
}
function tipoAnexo(url:string):TipoMensagem{
 const mime=contentTypePorExtensao(url),tipo=tipoPorMime(mime);
 if(!mime||tipo==="TEXTO"||tipo==="OUTRO")throw new ErroRegra("Tipo de arquivo não suportado para envio.");
 return tipo;
}
