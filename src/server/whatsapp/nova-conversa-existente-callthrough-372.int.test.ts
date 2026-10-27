import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";
const sessao=vi.hoisted(()=>({id:""}));
vi.mock("@/server/_shared/sessao",async original=>{const o=await original<typeof import("@/server/_shared/sessao")>();return{...o,exigirSessao:async()=>{const u=await o.carregarUsuarioFresco(sessao.id);if(!u)throw new o.ErroAutenticacao();return u;}};});
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { iniciarConversaPorNumero } from "./nova-conversa-acoes";

let vendedor:Awaited<ReturnType<typeof criarUsuario>>,outro:Awaited<ReturnType<typeof criarUsuario>>,numeroId:string,paisId:string,seq=0;
const tel=(n:number)=>`+5068666${String(n).padStart(4,"0")}`;
const comando=(telefone:string,chave="tentativa-ex-native372")=>({modo:"EXISTENTE" as const,telefone,numeroId,chaveIdempotencia:chave});
async function lead(telefoneE164:string,owner=vendedor.id){const pessoa=await prisma.pessoa.create({data:{nome:"Pessoa fictícia EX"}});const oportunidade=await prisma.oportunidade.create({data:{codigo:`L-EXN-${++seq}`,nome:"Lead fictício EX",telefoneE164,pessoaId:pessoa.id,vendedorDonoId:owner}});return{pessoa,oportunidade};}
async function estado(){return{pessoas:await prisma.pessoa.findMany({orderBy:{id:"asc"}}),leads:await prisma.oportunidade.findMany({orderBy:{id:"asc"}}),contatos:await prisma.contatoWhatsApp.findMany({orderBy:{id:"asc"}}),conversas:await prisma.conversaWhatsApp.findMany({orderBy:{id:"asc"}}),atendimentos:await prisma.atendimentoWhatsApp.findMany({orderBy:{id:"asc"}}),eventos:await prisma.evento.findMany({orderBy:{id:"asc"}}),mensagens:await prisma.mensagemWhatsApp.count(),intencoes:await prisma.intencaoMensagem.count(),contador:await prisma.contador.findUnique({where:{chave:"lead"}})};}
function observar(){
 const original=prisma.$transaction.bind(prisma),metricas:{fotos:number;upsertsContexto:number}[]=[];
 const spy=vi.spyOn(prisma,"$transaction").mockImplementation(((operacao:unknown,opcoes:unknown)=>{
  if(typeof operacao!=="function")return Reflect.apply(original,prisma,[operacao,opcoes]);
  const metrica={fotos:0,upsertsContexto:0};metricas.push(metrica);
  return original(async tx=>{const observado=new Proxy(tx,{get(alvo,p,receptor){const valor=Reflect.get(alvo,p,receptor);
   if(p==="$queryRaw")return async(...args:unknown[])=>{const resultado=await Reflect.apply(valor,alvo,args);const tag=args[0];if(Array.isArray(tag)&&tag.join("").includes("AS foto")){if(!Array.isArray(resultado))throw new Error("Instrumentação: resultado da foto não é lista");expect(resultado).toHaveLength(1);expect(resultado[0]).toHaveProperty("foto.autor.id",vendedor.id);metrica.fotos++;}return resultado;};
   if(p==="conversaWhatsApp")return new Proxy(valor,{get(modelo,acao){const fn=Reflect.get(modelo,acao);if(acao!=="upsert")return typeof fn==="function"?fn.bind(modelo):fn;return(...args:unknown[])=>{metrica.upsertsContexto++;return Reflect.apply(fn,modelo,args);};}});
   return typeof valor==="function"?valor.bind(alvo):valor;}}) as Prisma.TransactionClient;return Reflect.apply(operacao,undefined,[observado]);},opcoes as Parameters<typeof original>[1]);
 }) as typeof prisma.$transaction);return{metricas,parar:()=>spy.mockRestore()};
}
let fetchGuard:{mock:{calls:unknown[][]}};
beforeEach(async()=>{vi.restoreAllMocks();fetchGuard=vi.spyOn(globalThis,"fetch").mockImplementation(async()=>{throw new Error("Bloqueio do teste372: tentativa de rede inesperada.");});await truncarBanco();vendedor=await criarUsuario([Papel.VENDEDOR],"Vendedor fictício EX");outro=await criarUsuario([Papel.VENDEDOR],"Outro fictício EX");sessao.id=vendedor.id;numeroId=(await prisma.numeroWhatsApp.create({data:{telefoneE164:"+50689993331",rotulo:"Linha fictícia EX",driver:"MOTOR",sessao:"DESCONECTADO",finalidade:"VENDAS",donoId:vendedor.id,ativo:true}})).id;paisId=(await prisma.pais.create({data:{nome:"País fictício",codigoISO:"CR",moedaLocal:"CRC",ddi:"+506"}})).id;});
afterEach(()=>{try{expect(fetchGuard).not.toHaveBeenCalled();}finally{vi.restoreAllMocks();}});
it.each(["ausentes","contatoNulo"] as const)("EX %s: action+reader+garantirAtendimento+foto SQL reais só criam operacional",async(modo)=>{
 const telefone=tel(1),l=await lead(telefone);let contatoId:string|undefined;
 if(modo==="contatoNulo")contatoId=(await prisma.contatoWhatsApp.create({data:{telefoneE164:telefone}})).id;
 const antes=await estado(),fetchSpy=vi.spyOn(globalThis,"fetch").mockImplementation(async()=>{throw new Error("Bloqueio do teste372: tentativa de rede inesperada.");}),o=observar();let r:Awaited<ReturnType<typeof iniciarConversaPorNumero>>;
 try{r=await iniciarConversaPorNumero(comando(telefone));}finally{o.parar();}
 expect(r!.ok,JSON.stringify(r!)).toBe(true);if(!r!.ok||!r!.dado)throw new Error("Canário: action EX não retornou atendimento");
 expect(r!.dado).toEqual({atendimentoId:expect.any(String),criado:false});expect(r!.dado).not.toHaveProperty("leadId");expect(r!.dado).not.toHaveProperty("pessoaId");
 const a=await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:r!.dado.atendimentoId},include:{conversa:{include:{contato:true}}}}),c=a.conversa.contato;if(!c)throw new Error("Canário: contexto sem contato");
 expect(c).toMatchObject({telefoneE164:telefone,pessoaId:l.pessoa.id,leadId:l.oportunidade.id,alunoId:null,responsavelId:null});if(contatoId)expect(c.id).toBe(contatoId);
 expect(a).toMatchObject({contextoChave:"COMERCIAL:LINHA",finalidade:"COMERCIAL",leadId:l.oportunidade.id,responsavelId:vendedor.id,status:"EM_ATENDIMENTO",encerradoEm:null});
 const depois=await estado();expect(depois.pessoas).toEqual(antes.pessoas);expect(depois.leads).toEqual(antes.leads);expect(depois.contador).toEqual(antes.contador);expect(depois.mensagens).toBe(antes.mensagens);expect(depois.intencoes).toBe(antes.intencoes);
 expect(depois.contatos).toHaveLength(1);expect(depois.conversas).toHaveLength(1);expect(depois.atendimentos).toHaveLength(1);expect(depois.eventos.map(v=>v.tipo).sort()).toEqual(["AtendimentoInstitucionalAberto","ConversaIniciadaPorNumero"].sort());
 expect(o.metricas).toHaveLength(1);expect(o.metricas[0].fotos).toBeGreaterThanOrEqual(2);expect(o.metricas[0].upsertsContexto).toBe(1);expect(fetchSpy).not.toHaveBeenCalled();
});
it("contexto existente preserva responsável/carteira; replay/crossmodo/nova intenção têm auditoria canônica",async()=>{
 const telefone=tel(2),l=await lead(telefone),c=await prisma.contatoWhatsApp.create({data:{telefoneE164:telefone,pessoaId:l.pessoa.id,leadId:l.oportunidade.id}}),cv=await prisma.conversaWhatsApp.create({data:{numeroId,contatoId:c.id}}),a=await prisma.atendimentoWhatsApp.create({data:{conversaId:cv.id,contextoChave:"COMERCIAL:LINHA",finalidade:"COMERCIAL",leadId:l.oportunidade.id,responsavelId:outro.id,status:"EM_ATENDIMENTO"}});
 const antes=await estado(),o=observar(),entrada=comando(telefone,"ex-contexto-chave-372"),fetchSpy=vi.spyOn(globalThis,"fetch").mockImplementation(async()=>{throw new Error("Bloqueio do teste372: tentativa de rede inesperada.");});
 try{
  expect(await iniciarConversaPorNumero(entrada)).toEqual({ok:true,dado:{atendimentoId:a.id,criado:false}});const um=await estado();expect(um.pessoas).toEqual(antes.pessoas);expect(um.leads).toEqual(antes.leads);expect(um.atendimentos).toEqual(antes.atendimentos);expect(um.contatos).toEqual(antes.contatos);expect(um.eventos.filter(v=>v.tipo==="AtendimentoInstitucionalAberto")).toHaveLength(1);
  expect(await iniciarConversaPorNumero(entrada)).toEqual({ok:true,dado:{atendimentoId:a.id,criado:false}});expect(await estado()).toEqual(um);
  const conflito=await iniciarConversaPorNumero({...entrada,modo:"NOVO",ownerId:vendedor.id});expect(conflito.ok).toBe(false);if(!conflito.ok)expect(conflito.erro).toMatch(/já foi usada/);expect(await estado()).toEqual(um);
  expect(await iniciarConversaPorNumero({...entrada,chaveIdempotencia:"ex-contexto-outra-372"})).toEqual({ok:true,dado:{atendimentoId:a.id,criado:false}});const dois=await estado();expect(dois.atendimentos).toEqual(antes.atendimentos);expect(dois.pessoas).toEqual(antes.pessoas);expect(dois.leads).toEqual(antes.leads);expect(dois.eventos.filter(v=>v.tipo==="AtendimentoInstitucionalAberto")).toHaveLength(2);expect(dois.eventos.filter(v=>v.tipo==="ConversaIniciadaPorNumero")).toHaveLength(2);expect(dois.mensagens).toBe(0);expect(dois.intencoes).toBe(0);
 }finally{o.parar();}
 expect(o.metricas).toHaveLength(4);expect(o.metricas[0].fotos).toBeGreaterThanOrEqual(2);expect(o.metricas[1].fotos).toBeGreaterThanOrEqual(1);expect(fetchSpy).not.toHaveBeenCalled();
});
it("recusas reais semLead/oculto/ambíguo/outroLead/academia mantêm estado integral",async()=>{
 const fetchSpy=vi.spyOn(globalThis,"fetch").mockImplementation(async()=>{throw new Error("Bloqueio do teste372: tentativa de rede inesperada.");});
 for(const [i,modo]of["semLead","oculto","ambiguo","outroLead","academia"] .entries()){
  const telefone=tel(10+i);if(modo!=="semLead"){
   const l=await lead(telefone,modo==="oculto"?outro.id:vendedor.id);
   if(modo==="ambiguo")await lead(telefone);
   if(modo==="outroLead"){const alvo=await lead(tel(30+i));await prisma.contatoWhatsApp.create({data:{telefoneE164:telefone,pessoaId:l.pessoa.id,leadId:alvo.oportunidade.id}});}
   if(modo==="academia"){const aluno=await prisma.aluno.create({data:{primeiroNome:"Aluno fictício",paisId,telefoneE164:telefone}});await prisma.contatoWhatsApp.create({data:{telefoneE164:telefone,pessoaId:l.pessoa.id,leadId:l.oportunidade.id,alunoId:aluno.id}});}
  }
  const antes=await estado(),r=await iniciarConversaPorNumero(comando(telefone,`ex-recusa-${modo}-372`));expect(r.ok,modo).toBe(false);expect(r).not.toHaveProperty("dado");expect(await estado(),modo).toEqual(antes);
 }
 expect(fetchSpy).not.toHaveBeenCalled();
});
it("NOVO seguido de retry original permanece NOVO; modo EX com mesma chave conflita",async()=>{
 const telefone=tel(50),entrada={modo:"NOVO" as const,telefone,numeroId,ownerId:vendedor.id,chaveIdempotencia:"novo-then-replay-ex-372"},primeiro=await iniciarConversaPorNumero(entrada);expect(primeiro.ok,JSON.stringify(primeiro)).toBe(true);const depois=await estado();expect(await iniciarConversaPorNumero(entrada)).toEqual(primeiro);expect(await estado()).toEqual(depois);const ex=await iniciarConversaPorNumero(comando(telefone,entrada.chaveIdempotencia));expect(ex.ok).toBe(false);if(!ex.ok)expect(ex.erro).toMatch(/já foi usada/);expect(await estado()).toEqual(depois);
});