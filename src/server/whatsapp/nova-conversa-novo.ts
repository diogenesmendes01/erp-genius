import { Papel, Prisma } from "@prisma/client";
import { apenasPortal, ErroAutenticacao, ErroPermissao, ErroRegra, exigirPapel, type UsuarioSessao } from "@/server/_shared/sessao";
import { ChaveIdempotenciaSchema } from "@/server/_shared/validacao";
import { marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import { registrarEvento } from "@/server/_shared/evento";
import { gerarCodigo } from "@/lib/codigo";
import { LeadSchema } from "@/server/comercial/schema";
import { exigirDestinoComercial } from "@/server/comercial/destino-comercial";
import { criarRegistroLeadTx } from "@/server/comercial/criar-registro-lead-tx";
import { atendimentoVisivel } from "./atendimentos";
import { CHAVE_LINHA, donosDeLinhaVisiveis } from "./linha-comercial";
import { chaveLockPessoaTelefone } from "@/server/crm/pessoas";
import { normalizarNumeroNovaConversa } from "./telefone-nova-conversa";
import { classificarAlvoNovaConversa } from "./nova-conversa-interna";
import { lerCadastroNovaConversaTx, type PropriosNovaConversaTx } from "./nova-conversa-leitura";
import { criarPessoaDoContatoNovoTx } from "./nova-conversa-pessoa";

export interface EntradaRamoNovoConversa { autorId:string;ownerId:string;numeroId:string;telefoneE164:string;nome?:string;chaveIdempotencia:string }
interface Criada { atendimentoId:string;leadId:string;criado:true }
interface TuplaCriada extends Criada { pessoaId:string;contatoId:string;conversaId:string;numeroId:string;ownerId:string }
const mudou = () => new ErroRegra("O cadastro ou acesso mudou. Confira a conversa antes de repetir.");

async function contextoFresco(tx:Prisma.TransactionClient,e:EntradaRamoNovoConversa):Promise<UsuarioSessao> {
 const u=await tx.usuario.findUnique({where:{id:e.autorId},select:{ativo:true,nome:true,papeis:true,permissoes:true}});
 if(!u?.ativo)throw new ErroAutenticacao();
 const autor={id:e.autorId,nome:u.nome,papeis:u.papeis,permissoes:u.permissoes};
 if(apenasPortal(autor))throw new ErroPermissao();exigirPapel(autor,Papel.VENDEDOR,Papel.GERENTE_COMERCIAL);
 if(!e.ownerId)throw new ErroRegra("Selecione um vendedor ativo.");
 // O helper consulta papeis.has VENDEDOR do OWNER, sem temPapel(Admin) ou fallback.
 await exigirDestinoComercial(autor,e.ownerId,tx);
 const numero=await tx.numeroWhatsApp.findUnique({where:{id:e.numeroId},select:{id:true,ativo:true,finalidade:true,donoId:true}});
 if(!numero?.ativo||numero.finalidade!=="VENDAS")throw mudou();
 if(!autor.papeis.includes(Papel.ADMINISTRADOR)&&(!numero.donoId||!(await donosDeLinhaVisiveis(autor,tx)).includes(numero.donoId)))throw mudou();
 return autor;
}
async function conferirTupla(tx:Prisma.TransactionClient,e:EntradaRamoNovoConversa,t:TuplaCriada) {
 const autor=await contextoFresco(tx,e);
 const a=await atendimentoVisivel(autor,t.atendimentoId,false,tx);
 if(!a||a.encerradoEm||a.finalidade!=="COMERCIAL"||a.responsavelId!==e.autorId||a.leadId!==t.leadId||a.numeroId!==t.numeroId||a.conversaId!==t.conversaId||a.contatoId!==t.contatoId||a.conversa.grupoId||a.contato.telefoneE164!==e.telefoneE164||a.contato.pessoaId!==t.pessoaId||a.contato.leadId!==t.leadId||a.contato.alunoId||a.contato.responsavelId)throw mudou();
 const lead=await tx.oportunidade.findFirst({where:{id:t.leadId,telefoneE164:e.telefoneE164,pessoaId:t.pessoaId,vendedorDonoId:e.ownerId},select:{id:true,telefoneE164:true,pessoaId:true,vendedorDonoId:true}});
 if(!lead||lead.id!==t.leadId||lead.telefoneE164!==e.telefoneE164||lead.pessoaId!==t.pessoaId||lead.vendedorDonoId!==e.ownerId)throw mudou();
}
function replayValido(payload:Prisma.JsonValue,atendimentoId:string,e:EntradaRamoNovoConversa):TuplaCriada {
 if(!payload||typeof payload!=="object"||Array.isArray(payload))throw mudou();
 for(const campo of ["leadId","pessoaId","contatoId","conversaId","numeroId","ownerId"])if(typeof payload[campo]!=="string"||!payload[campo])throw mudou();
 if(payload.criado!==true||payload.numeroId!==e.numeroId||payload.ownerId!==e.ownerId)throw mudou();
 return{atendimentoId,leadId:payload.leadId as string,pessoaId:payload.pessoaId as string,contatoId:payload.contatoId as string,conversaId:payload.conversaId as string,numeroId:e.numeroId,ownerId:e.ownerId,criado:true};
}
function uniqueTelefone(e:unknown):boolean {
 return e instanceof Prisma.PrismaClientKnownRequestError&&e.code==="P2002"&&e.meta?.modelName==="ContatoWhatsApp"&&Array.isArray(e.meta.target)&&e.meta.target.length===1&&e.meta.target[0]==="telefoneE164";
}
/** Interno, NOVO-only. O caller é dono da única TX; não é endpoint ou resolução de owner. */
export async function criarRamoNovoConversaTx(tx:Prisma.TransactionClient,e:EntradaRamoNovoConversa):Promise<Criada> {
 if(normalizarNumeroNovaConversa(e.telefoneE164)!==e.telefoneE164)throw new ErroRegra("Informe o telefone internacional válido.");
 const chave=ChaveIdempotenciaSchema.parse(e.chaveIdempotencia);
 const nome=e.nome?.trim()?e.nome:"Contato WhatsApp";
 const marca=marcaIdempotencia(chave,{numeroId:e.numeroId,telefoneE164:e.telefoneE164,nome,ownerId:e.ownerId});
 if(!marca)throw mudou();
 const repetido=await repeticaoIdempotente(tx,{tipo:"ConversaIniciadaPorNumero",agregadoTipo:"AtendimentoWhatsApp",autorId:e.autorId,marca,mensagemConflito:"Esta tentativa já foi usada com outros dados. Confira a conversa antes de repetir."});
 if(repetido){
  const t=replayValido(repetido.payload,repetido.agregadoId,e);await conferirTupla(tx,e,t);
  return{atendimentoId:t.atendimentoId,leadId:t.leadId,criado:true};
 }
 const proprios:PropriosNovaConversaTx={};
 async function revalidarNovo(){await contextoFresco(tx,e);const cadastro=await lerCadastroNovaConversaTx(tx,{autorId:e.autorId,telefoneE164:e.telefoneE164,proprios});if(classificarAlvoNovaConversa({telefoneE164:e.telefoneE164},cadastro).tipo!=="novo")throw mudou();}
 await revalidarNovo();
 let contato;
 try{contato=await tx.contatoWhatsApp.create({data:{telefoneE164:e.telefoneE164,...(e.nome?.trim()?{nomeExibicao:e.nome}:{})}});}catch(erro){if(uniqueTelefone(erro))throw mudou();throw erro;}
 proprios.contato={id:contato.id,telefoneE164:e.telefoneE164,pessoaId:null,leadId:null};
 const tentativaPhone=await tx.$queryRaw<{adquirido:boolean}[]>`SELECT pg_try_advisory_xact_lock(hashtextextended(${chaveLockPessoaTelefone(e.telefoneE164)},0)) AS adquirido`;
 if(tentativaPhone.length!==1||tentativaPhone[0].adquirido!==true)throw mudou();
 await revalidarNovo();
 const pessoa=await criarPessoaDoContatoNovoTx(tx,contato,{nome,autorId:e.autorId});
 proprios.contato.pessoaId=pessoa.pessoaId;await revalidarNovo();
 const codigo=await gerarCodigo("lead",tx);await revalidarNovo();
 const dados=LeadSchema.parse({nome,telefoneE164:e.telefoneE164,origemCanal:"PROSPECCAO_ATIVA"});
 const leadId=await criarRegistroLeadTx(tx,{dados,codigo,telefoneE164:e.telefoneE164,pessoaId:pessoa.pessoaId,empresaId:null,donoId:e.ownerId,autorId:e.autorId,marca:null});
 proprios.lead={id:leadId,telefoneE164:e.telefoneE164,pessoaId:pessoa.pessoaId,vendedorDonoId:e.ownerId};await revalidarNovo();
 const vinculo=await tx.contatoWhatsApp.updateMany({where:{id:contato.id,telefoneE164:e.telefoneE164,pessoaId:pessoa.pessoaId,leadId:null,alunoId:null,responsavelId:null},data:{leadId}});
 if(vinculo.count!==1)throw mudou();proprios.contato.leadId=leadId;await revalidarNovo();
 const conversa=await tx.conversaWhatsApp.create({data:{numeroId:e.numeroId,contatoId:contato.id}});await revalidarNovo();
 const atendimento=await tx.atendimentoWhatsApp.create({data:{conversaId:conversa.id,contextoChave:CHAVE_LINHA,finalidade:"COMERCIAL",leadId,responsavelId:e.autorId,status:"EM_ATENDIMENTO"}});await revalidarNovo();
 await registrarEvento(tx,{tipo:"AtendimentoInstitucionalAberto",agregadoTipo:"AtendimentoWhatsApp",agregadoId:atendimento.id,autorId:e.autorId,payload:{finalidade:"COMERCIAL",leadId,alunoId:null,turmaId:null,matriculaId:null}});await revalidarNovo();
 const tupla:TuplaCriada={atendimentoId:atendimento.id,leadId,pessoaId:pessoa.pessoaId,contatoId:contato.id,conversaId:conversa.id,numeroId:e.numeroId,ownerId:e.ownerId,criado:true};
 await registrarEvento(tx,{tipo:"ConversaIniciadaPorNumero",agregadoTipo:"AtendimentoWhatsApp",agregadoId:atendimento.id,autorId:e.autorId,payload:{leadId,pessoaId:pessoa.pessoaId,contatoId:contato.id,conversaId:conversa.id,numeroId:e.numeroId,ownerId:e.ownerId,criado:true,...marca}});
 // Confirma inclusive restrições deferred/FKs ANTES da última leitura; nenhum write depois.
 await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
 await revalidarNovo();await conferirTupla(tx,e,tupla);
 return{atendimentoId:atendimento.id,leadId,criado:true};
}
