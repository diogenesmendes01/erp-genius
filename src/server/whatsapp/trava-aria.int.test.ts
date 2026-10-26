import { beforeEach, expect, it, vi } from "vitest";
import { Papel, PrismaClient } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared/sessao", async original => {
 const real = await original<typeof import("@/server/_shared/sessao")>();
 return { ...real, exigirSessao: async () => {
  const id = (await authMock())?.user?.id, u = id ? await real.carregarUsuarioFresco(id) : null;
  if (!u) throw new real.ErroAutenticacao();
  if (real.apenasPortal(u)) throw new real.ErroPermissao(); return u;
 } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const driver=vi.hoisted(()=>({texto:vi.fn(),midia:vi.fn(),template:vi.fn()}));
vi.mock("@/server/whatsapp/drivers/motor",()=>({driverMotor:{enviarTexto:driver.texto,enviarMidia:driver.midia,enviarTemplate:driver.template}}));
import{prisma}from"@/lib/prisma";
import{criarUsuario,truncarBanco}from"@/test/integracao";
import{criarNumeroSetor}from"@/test/integracao-whatsapp";
import{garantirAtendimento}from"./atendimentos";
import{enviarTextoInbox,enviarMidiaInbox}from"./acoes";
import{assumirConversaDaAria}from"./acoes-atendimento";
import{registrarNotaAtendimento}from"./acoes-conversa";
import{configPadrao}from"../aria/config-schema";
let c:Awaited<ReturnType<typeof cenario>>;
async function cenario(){const admin=await criarUsuario([Papel.ADMINISTRADOR]);const numero=await criarNumeroSetor({telefoneE164:"+5500000000358",setores:["COMERCIAL"],finalidade:"AGENDA"});const contato=await prisma.contatoWhatsApp.create({data:{telefoneE164:"+50680000358"}});const at=await prisma.$transaction(tx=>garantirAtendimento(tx,{numeroId:numero.id,contatoId:contato.id,finalidade:"COMERCIAL"}));const msg=await prisma.mensagemWhatsApp.create({data:{numeroId:numero.id,conversaId:at.conversaId,atendimentoId:at.id,direcao:"ENTRADA",driver:"MOTOR",corpo:"Fixture358"}});const turno=await prisma.turnoAgenteIA.create({data:{ancoraMensagemId:msg.id,atendimentoId:at.id,tipo:"ATENDIMENTO",resultado:"SUGERIU"}});await prisma.versaoAgenteIA.create({data:{numero:1,status:"PUBLICADA",config:configPadrao(),criadaPorId:admin.id,publicadaPorId:admin.id,publicadaEm:new Date()}});await prisma.agenteIA.create({data:{id:"aria",estado:"ATIVA"}});return{admin,numero,contato,at,turno};}
beforeEach(async()=>{await truncarBanco();authMock.mockReset();vi.clearAllMocks();c=await cenario();authMock.mockResolvedValue({user:{id:c.admin.id}});});
async function preparar(estado:"ia"|"aprovacao"|"handoff"){if(estado==="aprovacao")await prisma.acaoAgenteIA.create({data:{atendimentoId:c.at.id,turnoId:c.turno.id,acao:"RESPONDER",modoConfigurado:"SUGERIR",status:"SUGERIDA",confianca:90,reversivel:false,payload:{texto:"Fictícia"}}});if(estado==="handoff")await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{iaPausadaEm:new Date(),iaPausaMotivo:"HANDOFF"}});}
const enviar=(tipo:"texto"|"midia")=>tipo==="texto"?enviarTextoInbox({conversaId:c.at.id,texto:"Saída fictícia358"}):enviarMidiaInbox({conversaId:c.at.id,url:`/api/files/whatsapp-out/${c.admin.id}/fixture358.pdf`,legenda:"Anexo fictício358"});
it.each([['ia','texto'],['ia','midia'],['aprovacao','texto'],['aprovacao','midia'],['handoff','texto'],['handoff','midia']]as const)("358 action real recusa %s/%s antes da intenção e do driver",async(estado,tipo)=>{await preparar(estado);expect(await enviar(tipo)).toEqual({ok:false,erro:"Assuma a conversa para responder."});expect(await prisma.intencaoMensagem.count({where:{atendimentoId:c.at.id,origem:"HUMANO"}})).toBe(0);expect(driver.texto).not.toHaveBeenCalled();expect(driver.midia).not.toHaveBeenCalled();expect(driver.template).not.toHaveBeenCalled();});
it.each(['texto','midia']as const)("358 depois357 action real %s enfileiraHUMANO semdriverreal",async tipo=>{await preparar("handoff");expect((await assumirConversaDaAria(c.at.id)).ok).toBe(true);expect((await enviar(tipo)).ok).toBe(true);expect(await prisma.intencaoMensagem.count({where:{atendimentoId:c.at.id,origem:"HUMANO"}})).toBe(1);expect(driver.texto).not.toHaveBeenCalled();expect(driver.midia).not.toHaveBeenCalled();});
it("358 Nota interna permanece permitida enquantoAria sem intençãoexterna",async()=>{expect((await registrarNotaAtendimento({atendimentoId:c.at.id,nota:"Nota fictícia358",chaveIdempotencia:"358-nota-valida"})).ok).toBe(true);expect(await prisma.intencaoMensagem.count()).toBe(0);});
function sinal(){let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return{promise,resolve};}
async function limite<T>(p:Promise<T>,ms=2500):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([p,new Promise<never>((_,j)=>timer=setTimeout(()=>j(Error("Barreira nativa excedeu limite")),ms))]);}finally{clearTimeout(timer);}}
async function esperarBloqueio(pid:number){const ate=Date.now()+2500;while(Date.now()<ate){const rows=await prisma.$queryRaw<{espera:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))) AS espera`;if(rows[0].espera)return;await new Promise<void>(r=>setImmediate(r));}throw Error("A chamada não aguardou o pai real");}
async function duranteEspera(alterar:()=>Promise<unknown>){
 const preso=sinal(),soltar=sinal();let pid=0;
 const holder=prisma.$transaction(async tx=>{pid=(await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`)[0].pid;await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${c.at.id} FOR NO KEY UPDATE`;preso.resolve();await soltar.promise;},{timeout:12000});
 await limite(preso.promise);const chamada=enviar("texto");let mutacao:Promise<unknown>|null=null;
 try{await esperarBloqueio(pid);mutacao=alterar();await limite(mutacao);}finally{soltar.resolve();await holder;if(mutacao)await mutacao;}
 return chamada;
}
it.each(["reativada","config","config-removida","ator","numero","optout"]as const)("358 espera real relê %s antes de criar intenção",async caso=>{
 await prisma.configIA.create({data:{id:"ia",orcamentoMensalUsd:caso==="config"?0:100,acaoAoEstourar:"PAUSAR"}});
 if(caso!=="config")await prisma.agenteIA.update({where:{id:"aria"},data:{estado:"DESLIGADA"}});
 const r=await duranteEspera(()=>caso==="reativada"?prisma.agenteIA.update({where:{id:"aria"},data:{estado:"ATIVA"}}):caso==="config"?prisma.configIA.update({where:{id:"ia"},data:{orcamentoMensalUsd:100}}):caso==="config-removida"?prisma.configIA.delete({where:{id:"ia"}}):caso==="ator"?prisma.usuario.update({where:{id:c.admin.id},data:{ativo:false}}):caso==="numero"?prisma.numeroWhatsApp.update({where:{id:c.numero.id},data:{ativo:false}}):prisma.contatoWhatsApp.update({where:{id:c.contato.id},data:{optOutEm:new Date()}}));
 if(caso==="config-removida"){expect(r).toEqual({ok:false,erro:"A configuração da Aria mudou. Atualize a conversa antes de responder."});expect(await prisma.configIA.count()).toBe(0);}
 expect(r.ok).toBe(false);expect(await prisma.intencaoMensagem.count()).toBe(0);expect(driver.texto).not.toHaveBeenCalled();
});
it("358 pausaMANUAL357 enquanto envio espera pai permite somente depois da tomada real",async()=>{
 const preso=sinal(),soltar=sinal();let pid=0;
 const holder=prisma.$transaction(async tx=>{pid=(await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`)[0].pid;await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${c.at.id} FOR NO KEY UPDATE`;preso.resolve();await soltar.promise;},{timeout:12000});
 await limite(preso.promise);const tomada=assumirConversaDaAria(c.at.id);await esperarBloqueio(pid);const envio=enviar("texto");
 try{await esperarBloqueio(pid);}finally{soltar.resolve();await holder;}
 const[a,b]=await Promise.all([tomada,envio]);expect(a.ok&&b.ok).toBe(true);expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.at.id}})).iaPausaMotivo).toBe("MANUAL");expect(await prisma.intencaoMensagem.count({where:{origem:"HUMANO"}})).toBe(1);expect(driver.texto).not.toHaveBeenCalled();
});
it("358 pool1 comConfigausente materializa antespai e não abre conexão global naTX",async()=>{
 const url=new URL(process.env.DATABASE_URL!);url.searchParams.set("connection_limit","1");url.searchParams.set("pool_timeout","2");const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
 const{enfileirarSaidaInbox}=await import("./enfileirar-inbox");await prisma.agenteIA.update({where:{id:"aria"},data:{estado:"DESLIGADA"}});expect(await prisma.configIA.count()).toBe(0);
 try{const r=await enfileirarSaidaInbox(db,c.admin.id,c.at.id,{tipo:"texto",texto:"Pool1 fictício358"});expect(r.id).toBeTypeOf("string");expect(await prisma.configIA.count()).toBe(1);expect(await prisma.intencaoMensagem.count()).toBe(1);}finally{await db.$disconnect();}
});
it.each(["SHADOW","DESLIGADA","PAUSA_GLOBAL"]as const)("358 controle canônico %s conserva enfileiramento humano quando não há pendências",async estado=>{await prisma.agenteIA.update({where:{id:"aria"},data:estado==="PAUSA_GLOBAL"?{pausadoEm:new Date(),motivoPausa:"Fictício358"}:{estado}});expect((await enviar("texto")).ok).toBe(true);expect(await prisma.intencaoMensagem.count({where:{origem:"HUMANO"}})).toBe(1);expect(driver.texto).not.toHaveBeenCalled();});
it("358 posse da mídia segue negativa antes de qualquer intenção",async()=>{await prisma.agenteIA.update({where:{id:"aria"},data:{estado:"DESLIGADA"}});const r=await enviarMidiaInbox({conversaId:c.at.id,url:"/api/files/whatsapp-out/outro/fixture358.pdf"});expect(r).toEqual({ok:false,erro:"Anexo inválido: envie o arquivo pelo uploader da inbox."});expect(await prisma.intencaoMensagem.count()).toBe(0);});
it("358 reconciliação real357 MANUAL removehandoff e lista canônica sai parahumano",async()=>{await preparar("handoff");const{carregarUsuarioFresco}=await import("@/server/_shared/sessao");const{obterItemListaInbox}=await import("@/server/inbox/consultas-pagina");const{carregarAriaDoAtendimento}=await import("./consultas-inbox");const u=(await carregarUsuarioFresco(c.admin.id))!;expect((await obterItemListaInbox(u,c.at.id))?.estadoAria).toBe("handoff");expect((await assumirConversaDaAria(c.at.id)).ok).toBe(true);const[item,aria]=await Promise.all([obterItemListaInbox(u,c.at.id),carregarAriaDoAtendimento(u,c.at.id)]);expect(item?.estadoAria).toBe("humano");expect(item?.responsavelId).toBe(c.admin.id);expect(aria).toMatchObject({handoff:null,podeAssumirAria:true,pausada:true,motivo:"MANUAL"});});
let depoisDoPai:(()=>Promise<void>)|null=null;
function textoSQL(args:unknown){const a=args as {query?:string;text?:string;sql?:string}|unknown[];const p=Array.isArray(a)?a[0] as {text?:string;sql?:string;join?:(s:string)=>string}:null;return(Array.isArray(a)?p?.text??p?.sql??p?.join?.("$1")??"":a.query??a.text??a.sql??"").replace(/\s+/g," ").trim();}
prisma.$use(async(p,next)=>{const r=await next(p);if(p.action==="queryRaw"&&textoSQL(p.args)==='SELECT id FROM "AtendimentoWhatsApp" WHERE id = $1 FOR UPDATE')await depoisDoPai?.();return r;});
it("358 turno real cria sugestão enquanto envio espera pai; global desligado não mascara pendência nova",async()=>{
 const config=configPadrao();config.matriz.NOVO={...config.matriz.NOVO,RESPONDER:"SUGERE"};await prisma.versaoAgenteIA.updateMany({data:{config}});
 const{processarTurnoAria}=await import("../aria/turno/orquestrador");const{provedorSimulado}=await import("../aria/provedor/simulado");const preso=sinal(),soltar=sinal();let pid=0;
 depoisDoPai=async()=>{depoisDoPai=null;const rows=await prisma.$queryRaw<{pid:number}[]>`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND state='idle in transaction' AND query LIKE '%AtendimentoWhatsApp%'`;expect(rows.length).toBe(1);pid=rows[0].pid;preso.resolve();await soltar.promise;};
 const msg=await prisma.mensagemWhatsApp.create({data:{numeroId:c.numero.id,conversaId:c.at.conversaId,atendimentoId:c.at.id,direcao:"ENTRADA",driver:"MOTOR",corpo:"Quero conhecer a escola",providerMessageId:"fixture358-turno"}});
 const turno=processarTurnoAria(msg.id,{provedor:{nome:"simulado",async gerar(p){const r=await provedorSimulado.gerar(p);await prisma.agenteIA.update({where:{id:"aria"},data:{estado:"DESLIGADA"}});return{...r,texto:JSON.stringify({resposta:"Podemos ajudar com as turmas.",documentoId:null,acoes:[],confianca:95,handoff:null,fontes:[],humor:null})};}}});
 let envio:ReturnType<typeof enviar>|null=null;
 try{await limite(preso.promise);envio=enviar("texto");await esperarBloqueio(pid);soltar.resolve();expect(await turno).toMatchObject({resultado:"SUGERIU"});expect(await envio).toEqual({ok:false,erro:"Assuma a conversa para responder."});expect(await prisma.acaoAgenteIA.count({where:{atendimentoId:c.at.id,status:"SUGERIDA"}})).toBe(1);expect(await prisma.intencaoMensagem.count({where:{origem:"HUMANO"}})).toBe(0);}finally{soltar.resolve();depoisDoPai=null;await Promise.allSettled([turno,...(envio?[envio]:[])]);}
});