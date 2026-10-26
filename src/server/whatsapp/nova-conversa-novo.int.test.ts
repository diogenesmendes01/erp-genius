// PROPOSTA NÃO EXECUTADA. Destino sugerido só após ROOT aprovar: src/server/whatsapp/nova-conversa-novo.int.test.ts.
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { ErroAutenticacao, ErroRegra } from "@/server/_shared/sessao";
import * as auditoria from "@/server/_shared/evento";
import { chaveLockPessoaTelefone } from "@/server/crm/pessoas";
import { criarRamoNovoConversaTx, type EntradaRamoNovoConversa } from "./nova-conversa-novo";
let vendedor:Awaited<ReturnType<typeof criarUsuario>>,admin:Awaited<ReturnType<typeof criarUsuario>>,numeroId:string,paisId:string;
const tel=(n:number)=>`+5068777${String(n).padStart(4,"0")}`;
const e=(n:number):EntradaRamoNovoConversa=>({autorId:vendedor.id,ownerId:vendedor.id,numeroId,telefoneE164:tel(n),chaveIdempotencia:`tentativa-native372-${n}`});
const criar=(entrada:EntradaRamoNovoConversa)=>prisma.$transaction(tx=>criarRamoNovoConversaTx(tx,entrada),{timeout:30000});
const gate=()=>{let liberar!:()=>void;const promessa=new Promise<void>(r=>{liberar=r;});return{promessa,liberar};};
async function contagens(){return{pessoas:await prisma.pessoa.count(),contatos:await prisma.contatoWhatsApp.count(),leads:await prisma.oportunidade.count(),conversas:await prisma.conversaWhatsApp.count(),atendimentos:await prisma.atendimentoWhatsApp.count(),eventos:await prisma.evento.count(),intencoes:await prisma.intencaoMensagem.count(),mensagens:await prisma.mensagemWhatsApp.count(),contador:(await prisma.contador.findUnique({where:{chave:"lead"}}))?.valor??null};}
beforeAll(async()=>{
 await truncarBanco();vendedor=await criarUsuario([Papel.VENDEDOR],"Vendedor fictício");admin=await criarUsuario([Papel.ADMINISTRADOR],"Admin fictício");
 numeroId=(await prisma.numeroWhatsApp.create({data:{telefoneE164:"+50689990000",rotulo:"Linha fictícia",driver:"MOTOR",sessao:"DESCONECTADO",finalidade:"VENDAS",ativo:true,donoId:vendedor.id}})).id;
 paisId=(await prisma.pais.create({data:{nome:"País fictício",codigoISO:"CR",moedaLocal:"CRC",ddi:"+506"}})).id;
});
beforeEach(async()=>{vi.restoreAllMocks();await prisma.usuario.update({where:{id:vendedor.id},data:{ativo:true,papeis:[Papel.VENDEDOR]}});});
it("NOVO grava tupla/estado canônicos sem criar mensagem ou intenção",async()=>{
 const entrada=e(1),antes=await contagens(),r=await criar(entrada);expect(r.criado).toBe(true);
 const a=await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:r.atendimentoId},include:{conversa:{include:{contato:true}},lead:true}});
 expect(a).toMatchObject({finalidade:"COMERCIAL",status:"EM_ATENDIMENTO",contextoChave:"COMERCIAL:LINHA",responsavelId:vendedor.id,leadId:r.leadId,encerradoEm:null});
 expect(a.lead).toMatchObject({nome:"Contato WhatsApp",etapa:"NOVO",origemCanal:"PROSPECCAO_ATIVA",vendedorDonoId:vendedor.id,telefoneE164:entrada.telefoneE164});const contato=a.conversa.contato;if(!contato)throw new Error("Canário: conversa criada sem contato");expect(contato.pessoaId).toBe(a.lead?.pessoaId);
 expect(a.conversa).toMatchObject({numeroId,grupoId:null,ultimoInboundEm:null,ultimaMensagemEm:null});
 const depois=await contagens();expect(depois.intencoes).toBe(antes.intencoes);expect(depois.mensagens).toBe(antes.mensagens);
 const tipos=(await prisma.evento.findMany({where:{autorId:vendedor.id,OR:[{agregadoId:r.leadId},{agregadoId:r.atendimentoId},{agregadoId:a.lead!.pessoaId!}]}})).map(v=>v.tipo);
 expect(tipos.sort()).toEqual(["PessoaCriada","LeadCriado","LeadAtribuido","AtendimentoInstitucionalAberto","ConversaIniciadaPorNumero"].sort());
});
it("mesma chave retorna replay próprio fresco sem efeitos duplicados",async()=>{
 const entrada={...e(2),nome:"Nome manual fictício"},primeiro=await criar(entrada),antes=await contagens();expect(await criar(entrada)).toEqual(primeiro);expect(await contagens()).toEqual(antes);
 expect((await prisma.oportunidade.findUniqueOrThrow({where:{id:primeiro.leadId}})).nome).toBe("Nome manual fictício");
});
it("outro intent para telefone já criado não entra no ramo EXISTENTE nem duplica lead",async()=>{
 const entrada=e(3);await criar(entrada);const antes=await contagens();await expect(criar({...entrada,chaveIdempotencia:"segunda-chave-native372-3"})).rejects.toBeInstanceOf(ErroRegra);expect(await contagens()).toEqual(antes);
});
it("cadastro acadêmico identificado não é adotado nem alterado",async()=>{
 const entrada=e(4),a=await prisma.aluno.create({data:{primeiroNome:"Aluno fictício",paisId,telefoneE164:entrada.telefoneE164}}),antes=await contagens();
 await expect(criar(entrada)).rejects.toBeInstanceOf(ErroRegra);expect(await contagens()).toEqual(antes);expect(await prisma.aluno.findUniqueOrThrow({where:{id:a.id}})).toMatchObject({pessoaId:null,primeiroNome:"Aluno fictício"});
});
it("falha de evento injetada na fronteira comprova rollback SQL integral",async()=>{
 const entrada=e(5),antes=await contagens(),falha=new ErroRegra("Falha fictícia de evento final"),real=auditoria.registrarEvento;
 const spy=vi.spyOn(auditoria,"registrarEvento").mockImplementation(async(tx,evento)=>{if(evento.tipo==="ConversaIniciadaPorNumero")throw falha;return real(tx,evento);});
 try{await expect(criar(entrada)).rejects.toBe(falha);}finally{spy.mockRestore();}
 expect(await contagens()).toEqual(antes);
});
it("Phonebusy real recusa uma vez e não deixa Lead/Pessoa/Contato parcial",async()=>{
 const entrada=e(6),pronto=gate(),soltar=gate(),antes=await contagens();
 const identificador=(v:unknown)=>typeof v==="string"&&/^[A-Za-z0-9_$][A-Za-z0-9_$.[\]]{0,100}$/.test(v)?v:null;
 const erroSeguro=(erro:unknown,nivel=0):unknown=>{
  if(!erro||typeof erro!=="object"||nivel>2)return null;
  const r=(k:string)=>Reflect.get(erro,k),meta=r("meta");
  return{name:identificador(r("name")),code:identificador(r("code")),meta:meta&&typeof meta==="object"?{code:identificador(Reflect.get(meta,"code")),modelName:identificador(Reflect.get(meta,"modelName")),target:Array.isArray(Reflect.get(meta,"target"))?Reflect.get(meta,"target").map(identificador):identificador(Reflect.get(meta,"target"))}:null,cause:erroSeguro(r("cause"),nivel+1)};
 };
 const diretorio=mkdtempSync(join(tmpdir(),"erp-372-phonebusy-"));
 const persistir=(origem:"core"|"holder",fase:string,erro:unknown)=>{try{writeFileSync(join(diretorio,`${origem}.json`),JSON.stringify({origem,fase,erro:erroSeguro(erro)}),{encoding:"utf8",flag:"wx"});}catch(instrumental){throw new AggregateError(erro?[erro,instrumental]:[instrumental],"Falha instrumental ao persistir diagnóstico sanitizado");}};
 let faseCore="transaction.acquire",faseHolder="transaction.acquire",erroHolder:unknown;
 const holder=prisma.$transaction(async tx=>{faseHolder="advisory.acquire";await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${chaveLockPessoaTelefone(entrada.telefoneE164)},0))`;faseHolder="barrier.ready";pronto.liberar();await soltar.promessa;faseHolder="transaction.callback.complete";},{timeout:30000}).catch(erro=>{erroHolder=erro;throw erro;});
 try{
  await Promise.race([pronto.promessa,holder]);
  const tentativa=prisma.$transaction(async tx=>{
   faseCore="transaction.callback";
   const observado=new Proxy(tx,{get(alvo,p,receptor){const valor=Reflect.get(alvo,p,receptor);if(typeof valor==="function")return(...args:unknown[])=>{faseCore=`tx.${String(p)}`;return Reflect.apply(valor,alvo,args);};if(valor&&typeof valor==="object")return new Proxy(valor,{get(modelo,acao){const fn=Reflect.get(modelo,acao);if(typeof fn!=="function")return fn;return(...args:unknown[])=>{faseCore=`${String(p)}.${String(acao)}`;return Reflect.apply(fn,modelo,args);};}});return valor;}});
   return criarRamoNovoConversaTx(observado,entrada);
  },{timeout:30000}).catch(erro=>{persistir("core",faseCore,erro);throw erro;});
  await expect(tentativa).rejects.toBeInstanceOf(ErroRegra);expect(await contagens()).toEqual(antes);
 }finally{soltar.liberar();try{await holder;}finally{persistir("holder",faseHolder,erroHolder);}}
});
it("revogação após eventos e antes do SET real impede retorno e desfaz a TX",async()=>{
 const entrada=e(7),pronto=gate(),soltar=gate(),antes=await contagens();let barreira=true;
 const tarefa=prisma.$transaction(async tx=>{
  const observado=new Proxy(tx,{get(alvo,p,receptor){const fn=Reflect.get(alvo,p,receptor);if(p!=="$executeRaw"||typeof fn!=="function")return fn;return async(...args:unknown[])=>{const tag=args[0],texto=Array.isArray(tag)?tag.join(""):tag&&typeof tag==="object"&&typeof Reflect.get(tag,"sql")==="string"?Reflect.get(tag,"sql"):"";if(barreira&&texto.trim()==="SET CONSTRAINTS ALL IMMEDIATE"){barreira=false;pronto.liberar();await soltar.promessa;}return Reflect.apply(fn,alvo,args);};}});
  return criarRamoNovoConversaTx(observado,entrada);
 },{timeout:30000}).then(dado=>({dado,erro:null}),erro=>({dado:null,erro}));
 let erroFixture:unknown;let resultado:Awaited<typeof tarefa>;
 try{const fase=await Promise.race([pronto.promessa.then(()=>"SET"),tarefa.then(()=>"TERMINOU")]);expect(fase).toBe("SET");await prisma.usuario.update({where:{id:vendedor.id},data:{ativo:false}});}catch(erro){erroFixture=erro;}finally{soltar.liberar();resultado=await tarefa;}
 if(erroFixture)throw erroFixture;expect(resultado!.erro).toBeInstanceOf(ErroAutenticacao);expect(await contagens()).toEqual(antes);
});
it("Admin como owner sem papel VENDEDOR específico não cria nem substitui owner",async()=>{
 const entrada={...e(8),autorId:admin.id,ownerId:admin.id},antes=await contagens();await expect(criar(entrada)).rejects.toBeInstanceOf(ErroRegra);expect(await contagens()).toEqual(antes);
});
