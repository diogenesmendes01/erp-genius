import type {Pessoa,Prisma} from "@prisma/client";
import type {Db} from "@/server/whatsapp/escopo";
import {ErroPermissao,ErroRegra,apenasPortal,type UsuarioSessao} from "@/server/_shared/sessao";
import {temValidadorDocumento} from "@/server/_shared/validacao";
import {ZodError} from "zod";
import {escopoPessoas} from "./pessoas";
import {capacidadesCrm} from "./permissoes";
import {idadeCivilInstitucional} from "@/lib/idade-civil";
import {aplicarCadastroPessoa,avaliarDocumentoPessoa,auditoriaCadastroPessoa,camposCadastroAlterados,type CadastroPessoa,type PessoaCadastroPatch} from "./pessoa-cadastro-schema";
export type InformacoesCadastroPessoa={idade:number|null;documento:{tipoNome:string|null;paisNome:string|null;paisCodigoISO:string|null;validado:boolean}|null;catalogo:{id:string;nome:string;pais:{id:string;nome:string;codigoISO:string}}[]|null};
const CAMPOS=["documento","tipoDocumentoId","documentoPaisEmissor","nascimento"] as const;
const SELECT={id:true,documento:true,tipoDocumentoId:true,documentoPaisEmissor:true,nascimento:true,tipoDocumento:{select:{id:true,paisId:true,nome:true,validador:true,pais:{select:{id:true,nome:true,codigoISO:true}}}}} satisfies Prisma.PessoaSelect;
type CadastroDB=Pick<Pessoa,"documento"|"tipoDocumentoId"|"documentoPaisEmissor"|"nascimento">;
export function cadastroCivilDoBanco(p:CadastroDB):CadastroPessoa{return {documento:p.documento,tipoDocumentoId:p.tipoDocumentoId,documentoPaisEmissor:p.documentoPaisEmissor,nascimento:p.nascimento?.toISOString().slice(0,10)??null};}
export function temCadastroPessoa(input:unknown):boolean{return typeof input==="object"&&input!==null&&CAMPOS.some(k=>Object.prototype.hasOwnProperty.call(input,k)&&(input as Record<string,unknown>)[k]!==undefined);}
async function atorAtual(db:Db,id:string,editar=false){
 const u=await db.usuario.findUnique({where:{id},select:{id:true,nome:true,ativo:true,papeis:true,permissoes:true}});
 if(!u?.ativo||apenasPortal(u))return null;
 const c=capacidadesCrm(u.papeis);return c.has("contatos.ver")&&(!editar||c.has("contatos.editar"))?u:null;
}
async function pessoaAutorizada(db:Db,u:UsuarioSessao,id:string){return db.pessoa.findFirst({where:{AND:[{id,mescladaEmId:null},await escopoPessoas(u,db)]},select:SELECT});}
export async function carregarCadastroPessoaAutorizado(db:Db,autorId:string,pessoaId:string):Promise<{valores:CadastroPessoa;informacoes:InformacoesCadastroPessoa}|null>{
 const u=await atorAtual(db,autorId);if(!u)return null;
 if(!await pessoaAutorizada(db,u,pessoaId))return null;
 const cfg=await db.configuracaoOperacional.findUnique({where:{id:"escola"},select:{fusoInstitucional:true}});
 const podeEditar=capacidadesCrm(u.papeis).has("contatos.editar");
 const catalogo=podeEditar?await db.tipoDocumento.findMany({select:{id:true,nome:true,pais:{select:{id:true,nome:true,codigoISO:true}}},orderBy:[{paisId:"asc"},{nome:"asc"},{id:"asc"}]}):null;
 const final=await atorAtual(db,autorId);if(!final)return null;
 const p=await pessoaAutorizada(db,final,pessoaId);if(!p)return null;
 const publicador=await atorAtual(db,autorId);if(!publicador)return null;
 const vinculo=await db.pessoa.findFirst({where:{AND:[{id:pessoaId,mescladaEmId:null},await escopoPessoas(publicador,db)]},select:{id:true}});if(!vinculo)return null;
 const ultimoAtor=await atorAtual(db,autorId);if(!ultimoAtor||JSON.stringify(ultimoAtor.papeis)!==JSON.stringify(publicador.papeis))return null;
 const valores=cadastroCivilDoBanco(p),tipo=p.tipoDocumento;
 return {valores,informacoes:{idade:idadeCivilInstitucional(valores.nascimento,new Date(),cfg?.fusoInstitucional??null),
  documento:valores.documento!==null||valores.tipoDocumentoId!==null||valores.documentoPaisEmissor!==null?{tipoNome:tipo?.nome??null,paisNome:tipo?.pais.nome??null,paisCodigoISO:tipo?.pais.codigoISO??null,validado:avaliarDocumentoPessoa(valores,tipo??null).validado}:null,
  catalogo:capacidadesCrm(ultimoAtor.papeis).has("contatos.editar")?catalogo:null}};
}
export async function prepararCadastroPessoaTx(tx:Prisma.TransactionClient,autorId:string,pessoaAtual:Pessoa,input:PessoaCadastroPatch):Promise<{data:Prisma.PessoaUncheckedUpdateInput;payload:Prisma.InputJsonObject;mudou:boolean;revalidar:()=>Promise<UsuarioSessao>}>{
 const revalidar=async()=>{const u=await atorAtual(tx,autorId,true);if(!u)throw new ErroPermissao();if(!await pessoaAutorizada(tx,u,pessoaAtual.id))throw new ErroRegra("Contato não encontrado.");return u;};
 await revalidar();
 const antes=cadastroCivilDoBanco(pessoaAtual),depois=aplicarCadastroPessoa(antes,input),campos=camposCadastroAlterados(antes,depois);
 const documentoFornecido=(["documento","tipoDocumentoId","documentoPaisEmissor"] as const).some(k=>input[k]!==undefined);
 if(documentoFornecido&&depois.tipoDocumentoId){
  const id=depois.tipoDocumentoId;
  await tx.$queryRaw`SELECT id FROM "TipoDocumento" WHERE id=${id} FOR KEY SHARE NOWAIT`;
  const tipo=await tx.tipoDocumento.findUnique({where:{id},select:{id:true,paisId:true,validador:true}});
  const avaliacao=avaliarDocumentoPessoa(depois,tipo);
  if(!avaliacao.coerente)throw new ErroRegra("Tipo de documento indisponível. Atualize o cadastro.");
  if(depois.documento&&tipo&&temValidadorDocumento(tipo.validador)&&!avaliacao.validado)throw new ErroRegra("Documento inválido para o tipo selecionado. Corrija o documento e tente novamente.");
 }
 await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${autorId} FOR KEY SHARE NOWAIT`;
 await revalidar();
 const data:Prisma.PessoaUncheckedUpdateInput={};
 if(campos.includes("documento"))data.documento=depois.documento;
 if(campos.includes("tipoDocumentoId"))data.tipoDocumentoId=depois.tipoDocumentoId;
 if(campos.includes("documentoPaisEmissor"))data.documentoPaisEmissor=depois.documentoPaisEmissor;
 if(campos.includes("nascimento"))data.nascimento=depois.nascimento?new Date(depois.nascimento+"T00:00:00.000Z"):null;
 return {data,payload:auditoriaCadastroPessoa(antes,depois),mudou:campos.length>0,revalidar};
}
export function erroSeguroCadastroPessoa(erro:unknown):never{
 if(erro instanceof ErroRegra||erro instanceof ErroPermissao||erro instanceof ZodError)throw erro;
 if(typeof erro==="object"&&erro!==null){const e=erro as {code?:unknown;meta?:{code?:unknown}};
  if(e.code==="55P03"||e.meta?.code==="55P03")throw new ErroRegra("O cadastro está sendo atualizado. Recarregue e tente novamente.");
  if(e.code==="P2003")throw new ErroRegra("Uma referência do cadastro ficou indisponível. Recarregue e tente novamente.");
 }
 throw new ErroRegra("Não foi possível salvar os dados cadastrais. Tente novamente.");
}
