import {afterAll,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn()}));
vi.mock("@/lib/auth",()=>({auth:m.auth}));vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {prisma} from "@/lib/prisma";
import {truncarBanco} from "@/test/integracao";
import {cenarioCadastroPessoa,entradaCadastro,type CenarioCadastroPessoa} from "@/test/inbox-cadastro-pessoa";
import {editarPessoa} from "./contatos";
import {carregarCadastroPessoaAutorizado} from "./pessoa-cadastro";
import {editarContatoNoInbox} from "@/server/inbox/acoes-painel";
beforeEach(async()=>{vi.restoreAllMocks();await truncarBanco();m.auth.mockReset();});afterAll(()=>prisma.$disconnect());
const INVALIDO="FICTICIO-LATAM340"; // Valor positivo antigo preservado agora como negativo C1 explícito.
const ERRO="Documento inválido para o tipo selecionado. Corrija o documento e tente novamente.";
const como=(u:{id:string})=>m.auth.mockResolvedValue({user:{id:u.id}});
type PatchDoc={documento?:string|null;tipoDocumentoId?:string|null;documentoPaisEmissor?:string|null;nascimento?:string|null;nome?:string;cidade?:string|null};
async function eventos(c:CenarioCadastroPessoa){return prisma.evento.findMany({where:{tipo:"PessoaEditada",agregadoId:c.pessoa.id},orderBy:{id:"asc"}});}
function semValores(payload:unknown,valores:readonly string[]){const json=JSON.stringify(payload);for(const valor of valores)expect(json).not.toContain(valor);}
it("454 Pessoa inserida só com campos antigos mantém novosNULLs e update autorizado audita apenas presença",async()=>{
 const c=await cenarioCadastroPessoa();como(c.admin);const p=await prisma.pessoa.create({data:{nome:"Legado fictício454"}});
 expect(p).toMatchObject({documento:null,tipoDocumentoId:null,documentoPaisEmissor:null,nascimento:null});
 expect(await editarPessoa(p.id,entradaCadastro(c).pessoa)).toEqual({ok:true});
 expect(await prisma.pessoa.findUniqueOrThrow({where:{id:p.id}})).toMatchObject({documento:"1-0234-0567",tipoDocumentoId:c.tipo.id,documentoPaisEmissor:"CR",nascimento:new Date("2000-02-29T00:00:00Z")});
 const es=await prisma.evento.findMany({where:{tipo:"PessoaEditada",agregadoId:p.id}});expect(es).toHaveLength(1);
 expect(es[0]?.payload).toEqual({documento:{de:null,para:"definido"},nascimento:{de:null,para:"definido"}});semValores(es,["1-0234-0567","2000-02-29"]);
 expect((await carregarCadastroPessoaAutorizado(prisma,c.admin.id,p.id))?.informacoes.documento).toMatchObject({validado:true});
});
it("454 CRM e Inbox recusam inválido e101 sem mudar Pessoa/Event nem expor valor em erro/logger",async()=>{
 const c=await cenarioCadastroPessoa();como(c.dono);expect(await editarContatoNoInbox(c.atendimento.id,entradaCadastro(c))).toEqual({ok:true});
 const antes=await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}}),esAntes=await eventos(c);
 const capturas:string[]=[],spies=(["log","error","warn","info"] as const).map(canal=>{const original=console[canal].bind(console);return vi.spyOn(console,canal).mockImplementation((...args:unknown[])=>{capturas.push(args.map(String).join(" "));original(...args);});});
 try{
  console.warn("Canário público454 captura de logger");expect(capturas.some(x=>x.includes("Canário público454"))).toBe(true);
  const apis=[(p:PatchDoc)=>editarPessoa(c.pessoa.id,p),(p:PatchDoc)=>editarContatoNoInbox(c.atendimento.id,{pessoaIdEsperada:c.pessoa.id,pessoa:p})];
  for(const api of apis)for(const item of [{documento:INVALIDO,erro:ERRO},{documento:"X".repeat(101),erro:"O documento deve ter até 100 caracteres."}]){
   const r=await api({documento:item.documento,tipoDocumentoId:c.tipo.id});expect(r).toEqual({ok:false,erro:item.erro});semValores(r,[item.documento]);
   expect(await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).toEqual(antes);expect(await eventos(c)).toEqual(esAntes);
  }
  semValores(capturas,[INVALIDO,"X".repeat(101)]);semValores(esAntes,["1-0234-0567","2000-02-29"]);
 }finally{for(const spy of spies)spy.mockRestore();}
});
it("454 reapresentar grupo inválido histórico sem alterar valor recusa, omitido eDOB-only preservam legado",async()=>{
 const c=await cenarioCadastroPessoa();como(c.dono);await prisma.pessoa.update({where:{id:c.pessoa.id},data:{documento:INVALIDO,tipoDocumentoId:c.tipo.id,documentoPaisEmissor:"CR",nascimento:new Date("2000-02-29T00:00:00Z")}});
 const antes=await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}});
 for(const patch of [{documento:INVALIDO},{tipoDocumentoId:c.tipo.id},{documentoPaisEmissor:"CR"}]){
  expect(await editarPessoa(c.pessoa.id,patch)).toEqual({ok:false,erro:ERRO});expect(await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).toEqual(antes);expect(await eventos(c)).toEqual([]);
 }
 expect(await editarPessoa(c.pessoa.id,{})).toEqual({ok:true});expect(await eventos(c)).toEqual([]);
 expect(await editarContatoNoInbox(c.atendimento.id,{pessoaIdEsperada:c.pessoa.id,pessoa:{cidade:"Cidade permitida454"}})).toEqual({ok:true});
 expect(await editarPessoa(c.pessoa.id,{nascimento:"2001-03-01"})).toEqual({ok:true});
 expect(await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).toMatchObject({documento:INVALIDO,tipoDocumentoId:c.tipo.id,documentoPaisEmissor:"CR",nascimento:new Date("2001-03-01T00:00:00Z")});
 semValores(await eventos(c),[INVALIDO,"2001-03-01","2000-02-29"]);
});
it("454 seis tiposLATAM reais recusam reprovado e aceitam válidos pelo Inbox sem CPF-only",async()=>{
 const c=await cenarioCadastroPessoa();como(c.dono);
 const casos=[{iso:"BR",moeda:"BRL",ddi:"+55",validador:"cpf",documento:"529.982.247-25"},{iso:"CR",moeda:"CRC",ddi:"+506",validador:"cedula_cr",documento:"1-0234-0567"},{iso:"MX",moeda:"MXN",ddi:"+52",validador:"curp",documento:"HEGG560427MVZRRL04"},{iso:"AR",moeda:"ARS",ddi:"+54",validador:"dni_ar",documento:"12.345.678"},{iso:"SV",moeda:"USD",ddi:"+503",validador:"dui_sv",documento:"00016297-5"},{iso:"VE",moeda:"VES",ddi:"+58",validador:"passaporte",documento:"AB123456"}];
 let contagem=0;
 for(const item of casos){
  const pais=item.iso==="CR"?c.pais:await prisma.pais.create({data:{nome:"País fictício454 "+item.iso,codigoISO:item.iso,moedaLocal:item.moeda,ddi:item.ddi}});
  const tipo=await prisma.tipoDocumento.create({data:{paisId:pais.id,nome:"Tipo fictício454 "+item.validador,validador:item.validador}});
  const antes=await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}});
  expect(await editarContatoNoInbox(c.atendimento.id,{pessoaIdEsperada:c.pessoa.id,pessoa:{documento:INVALIDO,tipoDocumentoId:tipo.id,documentoPaisEmissor:item.iso}})).toEqual({ok:false,erro:ERRO});
  expect(await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).toEqual(antes);expect(await eventos(c)).toHaveLength(contagem);
  expect(await editarContatoNoInbox(c.atendimento.id,{pessoaIdEsperada:c.pessoa.id,pessoa:{documento:item.documento,tipoDocumentoId:tipo.id,documentoPaisEmissor:item.iso}})).toEqual({ok:true});contagem++;
  expect(await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).toMatchObject({documento:item.documento,tipoDocumentoId:tipo.id,documentoPaisEmissor:item.iso});
  expect((await carregarCadastroPessoaAutorizado(prisma,c.dono.id,c.pessoa.id))?.informacoes.documento).toMatchObject({validado:true});expect(await eventos(c)).toHaveLength(contagem);
 }
 semValores(await eventos(c),[INVALIDO,...casos.map(x=>x.documento)]);
});
it("454 tipossemvalidador conhecido aceitam100 eNULL opcional, sem alterar nascimento ou abrir ACLguest",async()=>{
 const c=await cenarioCadastroPessoa();como(c.dono);await prisma.pessoa.update({where:{id:c.pessoa.id},data:{nascimento:new Date("2000-02-29T00:00:00Z")}});
 for(const validador of ["","futuro454","__proto__"]){
  await prisma.tipoDocumento.update({where:{id:c.tipo.id},data:{validador}});
  expect(await editarPessoa(c.pessoa.id,{documento:"U".repeat(100),tipoDocumentoId:c.tipo.id})).toEqual({ok:true});
  expect((await carregarCadastroPessoaAutorizado(prisma,c.dono.id,c.pessoa.id))?.informacoes.documento).toMatchObject({validado:false});
 }
 expect(await editarPessoa(c.pessoa.id,{documento:null})).toEqual({ok:true});await prisma.tipoDocumento.update({where:{id:c.tipo.id},data:{validador:"cedula_cr"}});
 expect(await editarPessoa(c.pessoa.id,{documento:null,tipoDocumentoId:c.tipo.id})).toEqual({ok:true});
 expect(await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).toMatchObject({documento:null,tipoDocumentoId:c.tipo.id,nascimento:new Date("2000-02-29T00:00:00Z")});
 await prisma.participanteAtendimentoWhatsApp.create({data:{atendimentoId:c.atendimento.id,usuarioId:c.guest.id,concedenteId:c.dono.id,inicio:new Date(Date.now()-60000),fim:new Date(Date.now()+3600000),motivo:"Leitura fictícia454"}});
 const antes=await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}}),esAntes=await eventos(c);como(c.guest);
 const negado=await editarContatoNoInbox(c.atendimento.id,{pessoaIdEsperada:c.pessoa.id,pessoa:{documento:INVALIDO,tipoDocumentoId:c.tipo.id}});
 expect(negado).toEqual({ok:false,erro:"Você não tem acesso a esta função do CRM."});semValores(negado,[INVALIDO]);
 expect(await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).toEqual(antes);expect(await eventos(c)).toEqual(esAntes);
});
