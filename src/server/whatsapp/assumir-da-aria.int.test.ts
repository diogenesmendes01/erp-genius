import { beforeEach, expect, it, vi } from "vitest";
import { Papel, PrismaClient, type AcaoAgenteIATipo, type MotivoPausaAtendimentoIA } from "@prisma/client";
const { authMock, papeisExternosPortal } = vi.hoisted(() => ({ authMock: vi.fn(), papeisExternosPortal: [] as string[][] }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared/sessao", async original => {
 const real = await original<typeof import("@/server/_shared/sessao")>();
 return { ...real, exigirSessao: async () => {
  const id = (await authMock())?.user?.id, u = id ? await real.carregarUsuarioFresco(id) : null;
  if (!u) throw new real.ErroAutenticacao();
  papeisExternosPortal.push([...u.papeis]);
  if (real.apenasPortal(u)) throw new real.ErroPermissao(); return u;
 } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { assumirConversaDaAria, devolverParaFila } from "./acoes-atendimento";
import { devolverParaAria } from "../aria/pausa";
import { assumirAriaNoBanco } from "./assumir-aria";
import { configPadrao } from "../aria/config-schema";
import { processarTurnoAria } from "../aria/turno/orquestrador";
import { provedorSimulado } from "../aria/provedor/simulado";
import { expirarSugestoesAria } from "../aria/expiracao";
import { aprovarSugestaoNoInbox } from "../aria/decisao-inbox";
import { criarTarefa } from "../crm/tarefas";
import { carregarAriaDoAtendimento } from "./consultas-inbox";
// RED caracterizou o legado; GREEN usa a nova fronteira pública.
const assumir = assumirConversaDaAria;
let c: Awaited<ReturnType<typeof cenario>>;
async function cenario() {
 const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin fictício"), outro = await criarUsuario([Papel.ADMINISTRADOR], "Outro fictício");
 const numero = await criarNumeroSetor({ telefoneE164: "+5500000000357", setores: ["COMERCIAL"], finalidade: "AGENDA" });
 const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50680000357" } });
 const at = await prisma.$transaction(tx => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL" }));
 const ancora = await prisma.mensagemWhatsApp.create({ data: {numeroId:numero.id,conversaId:at.conversaId,atendimentoId:at.id,direcao:"ENTRADA",corpo:"Fixture357",driver:"MOTOR"} });
 const turno = await prisma.turnoAgenteIA.create({ data: { ancoraMensagemId:ancora.id,atendimentoId:at.id,tipo:"ATENDIMENTO",resultado:"SUGERIU" } });
 return {admin,outro,numero,contato,at,turno};
}
beforeEach(async()=>{await truncarBanco();authMock.mockReset();papeisExternosPortal.length=0;c=await cenario();authMock.mockResolvedValue({user:{id:c.admin.id}});});
const estado = () => prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:c.at.id}});
async function sugestao(acao: AcaoAgenteIATipo = "RESPONDER") {
 return prisma.acaoAgenteIA.create({data:{turnoId:c.turno.id,atendimentoId:c.at.id,acao,modoConfigurado:"SUGERIR",status:"SUGERIDA",confianca:90,payload:{texto:"Sugestão fictícia"},reversivel:false}});
}
it("357 assumir atribui e grava pausa MANUAL com evento auditável",async()=>{
 expect((await assumir(c.at.id)).ok).toBe(true);const a=await estado();expect(a.responsavelId).toBe(c.admin.id);expect(a.iaPausaMotivo).toBe("MANUAL");expect(a.iaPausadaEm).not.toBeNull();
 const e=await prisma.evento.findFirstOrThrow({where:{tipo:"AtendimentoAssumido",agregadoId:c.at.id}});expect(e.payload).toMatchObject({de:null,para:c.admin.id,daAria:true});
});
it.each(["HANDOFF","CELULAR","HUMANO_RESPONDEU"] as MotivoPausaAtendimentoIA[])("357 pausa anterior %s vira MANUAL sem apagar histórico",async motivo=>{
 const antes=new Date("2026-01-01T00:00:00Z");await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{iaPausadaEm:antes,iaPausaMotivo:motivo}});
 await prisma.evento.create({data:{tipo:"AriaPausadaNoAtendimento",agregadoTipo:"AtendimentoWhatsApp",agregadoId:c.at.id,payload:{motivo}}});
 expect((await assumir(c.at.id)).ok).toBe(true);const a=await estado();expect(a.iaPausaMotivo).toBe("MANUAL");expect(a.iaPausadaEm!.getTime()).toBeGreaterThan(antes.getTime());
 const eventos=await prisma.evento.findMany({where:{tipo:"AriaPausadaNoAtendimento",agregadoId:c.at.id}});expect(eventos).toHaveLength(2);expect(eventos.map(e=>e.payload)).toEqual(expect.arrayContaining([expect.objectContaining({motivo}),expect.objectContaining({motivo:"MANUAL"})]));
});
it("357 todas as SUGERIDA, inclusive CRM, são rejeitadas uma vez; executadas permanecem",async()=>{
 const mensagem=await sugestao(),crm=await sugestao("NOTA_INTERNA"),executada=await prisma.acaoAgenteIA.create({data:{turnoId:c.turno.id,atendimentoId:c.at.id,acao:"NOTA_INTERNA",modoConfigurado:"EXECUTAR",status:"EXECUTADA",confianca:90,payload:{texto:"Histórico"},reversivel:false}});
 expect((await assumir(c.at.id)).ok).toBe(true);
 for(const s of [mensagem,crm]){const a=await prisma.acaoAgenteIA.findUniqueOrThrow({where:{id:s.id}});expect(a.status).toBe("REJEITADA");expect(a.decididaPorId).toBe(c.admin.id);expect(await prisma.evento.count({where:{tipo:"AcaoAriaRejeitada",agregadoId:s.id}})).toBe(1);}
 expect((await prisma.acaoAgenteIA.findUniqueOrThrow({where:{id:executada.id}})).status).toBe("EXECUTADA");
});
it("357 replay mantém mesmo ciclo MANUAL e não duplica eventos",async()=>{
 await sugestao();expect((await assumir(c.at.id)).ok).toBe(true);const antes=await estado(),eventos=await prisma.evento.count();expect((await assumir(c.at.id)).ok).toBe(true);expect((await estado()).iaPausadaEm).toEqual(antes.iaPausadaEm);expect(await prisma.evento.count()).toBe(eventos);expect(antes.iaPausaMotivo).toBe("MANUAL");
});
it("357 já responsável também assume a condução e outro responsável é recusado",async()=>{
 await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{responsavelId:c.admin.id}});expect((await assumir(c.at.id)).ok).toBe(true);expect((await estado()).iaPausaMotivo).toBe("MANUAL");
 authMock.mockResolvedValue({user:{id:c.outro.id}});expect((await assumir(c.at.id)).ok).toBe(false);
});
it("357 cancela só IA pendente/adiada, preserva ENVIANDO e HUMANO",async()=>{
 const ids=[];for(const [origem,status] of [["IA","PENDENTE"],["IA","ADIADA"],["IA","ENVIANDO"],["HUMANO","PENDENTE"]] as const)ids.push(await prisma.intencaoMensagem.create({data:{numeroId:c.numero.id,contatoId:c.contato.id,atendimentoId:c.at.id,origem,status,tipo:"TEXTO",corpoRenderizado:"Fixture357",...(origem==="HUMANO"?{autorId:c.admin.id}:{})}}));
 expect((await assumir(c.at.id)).ok).toBe(true);expect(await Promise.all(ids.map(i=>prisma.intencaoMensagem.findUniqueOrThrow({where:{id:i.id},select:{status:true}})))).toEqual([{status:"CANCELADA"},{status:"CANCELADA"},{status:"ENVIANDO"},{status:"PENDENTE"}]);
});

function sinal() { let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return{promise,resolve}; }
let observar:((query:string)=>Promise<void>)|null=null;
let depoisCancelamento:(()=>Promise<void>)|null=null;
function consulta(args:unknown):string {const a=args as {query?:string;text?:string;sql?:string}|unknown[];const primeiro=Array.isArray(a)?a[0] as {text?:string;sql?:string;join?:(separador:string)=>string}:null;return (Array.isArray(a)?(primeiro?.text??primeiro?.sql??primeiro?.join?.("$1")??""):(a?.query??a?.text??a?.sql??"")).replace(/\s+/g," ").trim();}
// Só observação DEPOIS de next: SQL, retorno, ACL, executor e transações de produção permanecem reais.
prisma.$use(async(params,next)=>{const r=await next(params);if(params.model==="IntencaoMensagem"&&params.action==="updateMany")await depoisCancelamento?.();if(params.action==="queryRaw")await observar?.(consulta(params.args));return r;});
const Q_ACOES='SELECT id FROM "AcaoAgenteIA" WHERE "atendimentoId"=$1 AND status=\'SUGERIDA\' ORDER BY id ASC FOR UPDATE';
const Q_PAI='SELECT id FROM "AtendimentoWhatsApp" WHERE id=$1 FOR NO KEY UPDATE';
async function prontaParaTurno() {
 const config=configPadrao();config.matriz.NOVO={...config.matriz.NOVO,RESPONDER:"SUGERE"};
 await prisma.versaoAgenteIA.create({data:{numero:1,status:"PUBLICADA",config,criadaPorId:c.admin.id,publicadaPorId:c.admin.id,publicadaEm:new Date()}});
 await prisma.agenteIA.create({data:{id:"aria",estado:"ATIVA"}});
}
let seq=0;
async function turnoReal() {
 const m=await prisma.mensagemWhatsApp.create({data:{numeroId:c.numero.id,conversaId:c.at.conversaId,atendimentoId:c.at.id,direcao:"ENTRADA",corpo:"Gostaria de conhecer a escola",driver:"MOTOR",providerMessageId:`357-turno-${++seq}`}});
 return processarTurnoAria(m.id,{provedor:{nome:"simulado",async gerar(p){return{...await provedorSimulado.gerar(p),texto:JSON.stringify({resposta:"Olá, em que posso ajudar?",documentoId:null,acoes:[],confianca:90,handoff:null,fontes:[],humor:null})};}}});
}
it("357 phantom nativo: turno cria sob Atendimento enquanto Assumir segura ação; reinicia TX inteira",async()=>{
 await sugestao();await prontaParaTurno();let tentativas=0;
 observar=async q=>{if(q!==Q_ACOES)return;tentativas++;if(tentativas===1)expect(await turnoReal()).toMatchObject({resultado:"SUGERIU"});};
 try{expect((await assumir(c.at.id)).ok).toBe(true);expect(tentativas).toBe(2);expect(await prisma.acaoAgenteIA.count({where:{atendimentoId:c.at.id,status:"SUGERIDA"}})).toBe(0);expect(await prisma.acaoAgenteIA.count({where:{atendimentoId:c.at.id,status:"REJEITADA"}})).toBe(2);expect(await prisma.evento.count({where:{tipo:"AtendimentoAssumido",agregadoId:c.at.id}})).toBe(1);}finally{observar=null;}
});
it("357 três phantoms reais esgotam retry sem pausa, responsável ou rejeição parcial",async()=>{
 await sugestao();await prontaParaTurno();let tentativas=0;
 observar=async q=>{if(q===Q_ACOES){tentativas++;expect(await turnoReal()).toMatchObject({resultado:"SUGERIU"});}};
 try{const r=await assumir(c.at.id);expect(r).toEqual({ok:false,erro:"Novas sugestões chegaram durante a operação. Atualize a conversa e tente novamente."});expect(tentativas).toBe(3);const a=await estado();expect(a.responsavelId).toBeNull();expect(a.iaPausadaEm).toBeNull();expect(await prisma.acaoAgenteIA.count({where:{status:"SUGERIDA"}})).toBe(4);expect(await prisma.evento.count({where:{tipo:{in:["AriaPausadaNoAtendimento","AcaoAriaRejeitada","AtendimentoAssumido"]}}})).toBe(0);}finally{observar=null;}
});
it("357 dupla tomada simultânea do mesmo autor confirma uma vez",async()=>{
 await sugestao();const r=await Promise.all([assumir(c.at.id),assumir(c.at.id)]);expect(r.every(x=>x.ok)).toBe(true);expect(await prisma.evento.count({where:{tipo:"AtendimentoAssumido",agregadoId:c.at.id}})).toBe(1);expect(await prisma.evento.count({where:{tipo:"AcaoAriaRejeitada"}})).toBe(1);
});
it("357 revogação durante espera nativa pelo pai recusa sem efeitos",async()=>{
 await sugestao();const preso=sinal(),soltar=sinal();let pid=0;
 const detentor=prisma.$transaction(async tx=>{const rows=await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`;pid=rows[0].pid;await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${c.at.id} FOR UPDATE`;preso.resolve();await soltar.promise;},{timeout:10000});
 await esperarBarreira(preso.promise);const chamada=assumir(c.at.id);
 try{let viu=false;const limite=Date.now()+2500;while(Date.now()<limite){const rows=await prisma.$queryRaw<{espera:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))) AS espera`;if(rows[0].espera){viu=true;break;}await new Promise<void>(r=>setImmediate(r));}expect(viu).toBe(true);await prisma.usuario.update({where:{id:c.admin.id},data:{ativo:false}});}finally{soltar.resolve();await detentor;}
 expect((await chamada).ok).toBe(false);expect((await estado()).responsavelId).toBeNull();expect((await estado()).iaPausadaEm).toBeNull();expect(await prisma.acaoAgenteIA.count({where:{status:"SUGERIDA"}})).toBe(1);expect(await prisma.evento.count()).toBe(0);
});
it("357 aprovação354 real vence antes da tomada sem inversão Acao/Atendimento",async()=>{
 const s=await sugestao("NOTA_INTERNA"),preso=sinal(),soltar=sinal();let pegou=false;
 observar=async q=>{if(!pegou&&q==='SELECT id FROM "AcaoAgenteIA" WHERE id=$1 FOR UPDATE'){pegou=true;preso.resolve();await soltar.promise;}};
 const aprovacao=aprovarSugestaoNoInbox(c.at.id,s.id);await esperarBarreira(preso.promise);const tomada=assumir(c.at.id);
 try{await esperarBloqueioNativo();soltar.resolve();const [a,b]=await Promise.all([aprovacao,tomada]);expect(a.ok&&b.ok).toBe(true);expect((await prisma.acaoAgenteIA.findUniqueOrThrow({where:{id:s.id}})).status).toBe("APROVADA");expect((await estado()).iaPausaMotivo).toBe("MANUAL");}finally{soltar.resolve();observar=null;await Promise.allSettled([aprovacao,tomada]);}
});
it("357 expiração real espera a ação pré-travada e revalida o status rejeitado",async()=>{
 const s=await sugestao();await prisma.acaoAgenteIA.update({where:{id:s.id},data:{expiraEm:new Date(Date.now()-1000)}});const preso=sinal(),soltar=sinal();let pegou=false;
 observar=async q=>{if(!pegou&&q===Q_ACOES){pegou=true;preso.resolve();await soltar.promise;}};
 const tomada=assumir(c.at.id);await esperarBarreira(preso.promise);const expirar=expirarSugestoesAria();
 try{await esperarBloqueioNativo();soltar.resolve();expect((await tomada).ok).toBe(true);expect(await expirar).toEqual({expiradas:0,handoffs:0});expect((await prisma.acaoAgenteIA.findUniqueOrThrow({where:{id:s.id}})).status).toBe("REJEITADA");}finally{soltar.resolve();observar=null;await Promise.allSettled([tomada,expirar]);}
});
it.each([Papel.ADMINISTRADOR,Papel.VENDEDOR])("357 núcleo db-aware com pool1 e %s sem conexão global dentro da TX",async papel=>{
 const u=papel===Papel.ADMINISTRADOR?c.admin:await criarUsuario([papel]);if(papel===Papel.VENDEDOR)await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{responsavelId:u.id}});
 await sugestao();const url=new URL(process.env.DATABASE_URL!);url.searchParams.set("connection_limit","1");url.searchParams.set("pool_timeout","2");const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
 try{expect(await assumirAriaNoBanco(db,u.id,c.at.id)).toBe(true);expect((await estado()).iaPausaMotivo).toBe("MANUAL");}finally{await db.$disconnect();}
});
it("357 FK331: tarefa CRM conclui enquanto o novo pai NO KEY está retido",async()=>{
 const cat=await seedCatalogoMinimo();await prisma.configuracaoOperacional.upsert({where:{id:"escola"},create:{id:"escola",fusoInstitucional:"UTC"},update:{fusoInstitucional:"UTC"}});const lead=await prisma.oportunidade.create({data:{nome:"Fictício357",paisId:cat.pais.id,telefoneE164:c.contato.telefoneE164,vendedorDonoId:c.admin.id}});await prisma.contatoWhatsApp.update({where:{id:c.contato.id},data:{leadId:lead.id}});await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{leadId:lead.id}});await sugestao();const preso=sinal(),soltar=sinal();let pegou=false;
 observar=async q=>{if(!pegou&&q===Q_PAI){pegou=true;preso.resolve();await soltar.promise;}};const tomada=assumir(c.at.id);await esperarBarreira(preso.promise);
 try{const tarefa=await criarTarefa({titulo:"FK331 fixture357",tipo:"OUTRO",leadId:lead.id,atendimentoId:c.at.id});expect(tarefa).toEqual({ok:true,dado:{id:expect.any(String)}});soltar.resolve();expect(await tomada).toEqual({ok:true,dado:undefined});expect(await prisma.evento.count({where:{tipo:"TarefaCriada",agregadoTipo:"Tarefa"}})).toBe(1);}finally{soltar.resolve();observar=null;await tomada;}
});

async function esperarBarreira(p:Promise<void>){let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([p,new Promise<void>((_,reject)=>{timer=setTimeout(()=>reject(Error("Barreira de SQL nativo não observada")),2000);})]);}finally{if(timer)clearTimeout(timer);}}

it("DTO357 capacidade contextual acompanha a mesma política de tomada e recusa outro responsável",async()=>{
 expect(await carregarAriaDoAtendimento(c.admin,c.at.id)).toMatchObject({podeAssumirAria:true});
 await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{responsavelId:c.admin.id}});
 expect(await carregarAriaDoAtendimento(c.admin,c.at.id)).toMatchObject({podeAssumirAria:true});
 expect(await carregarAriaDoAtendimento(c.outro,c.at.id)).toMatchObject({podeAssumirAria:false});
});

it.each(["encerrado","numero-inativo","optout","outro-responsavel"] as const)("357 negativa %s recusa sem rejeição ou pausa",async caso=>{
 await sugestao();if(caso==="encerrado")await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{encerradoEm:new Date(),status:"ENCERRADO"}});
 if(caso==="numero-inativo")await prisma.numeroWhatsApp.update({where:{id:c.numero.id},data:{ativo:false}});
 if(caso==="optout")await prisma.contatoWhatsApp.update({where:{id:c.contato.id},data:{optOutEm:new Date()}});
 if(caso==="outro-responsavel")await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{responsavelId:c.outro.id}});
 expect((await assumir(c.at.id)).ok).toBe(false);expect((await estado()).iaPausadaEm).toBeNull();expect(await prisma.acaoAgenteIA.count({where:{status:"SUGERIDA"}})).toBe(1);expect(await prisma.evento.count()).toBe(0);
});
it("357 convite só leitura e grupo não concedem nova alçada",async()=>{
 const leitor=await criarUsuario([Papel.FINANCEIRO]);await prisma.participanteAtendimentoWhatsApp.create({data:{atendimentoId:c.at.id,usuarioId:leitor.id,concedenteId:c.admin.id,motivo:"Leitura de fixture",inicio:new Date(Date.now()-1000),fim:new Date(Date.now()+60000),podeEnviar:false}});
 authMock.mockResolvedValue({user:{id:leitor.id}});expect(await carregarAriaDoAtendimento(leitor,c.at.id)).toMatchObject({podeAssumirAria:false});expect((await assumir(c.at.id)).ok).toBe(false);
 const grupo=await prisma.grupoWhatsApp.create({data:{numeroId:c.numero.id,grupoJid:"357-fake@g.us",nome:"Fixture357"}});const conversa=await prisma.conversaWhatsApp.create({data:{numeroId:c.numero.id,grupoId:grupo.id}});await expect(prisma.atendimentoWhatsApp.create({data:{conversaId:conversa.id,contextoChave:"grupo357",finalidade:"COMERCIAL"}})).rejects.toThrow("Conversa de grupo não abre atendimento");
 authMock.mockResolvedValue({user:{id:c.admin.id}});expect((await assumir(conversa.id)).ok).toBe(false);expect(await prisma.atendimentoWhatsApp.count({where:{conversaId:conversa.id}})).toBe(0);
});

it("357 reativação entre tentativas invalida recibo e cria novo ciclo MANUAL auditável",async()=>{
 expect((await assumir(c.at.id)).ok).toBe(true);const primeira=await estado();expect((await devolverParaAria(c.at.id)).ok).toBe(true);expect((await estado()).iaPausadaEm).toBeNull();
 expect((await assumir(c.at.id)).ok).toBe(true);expect((await estado()).iaPausadaEm).not.toEqual(primeira.iaPausadaEm);expect(await prisma.evento.count({where:{tipo:"AtendimentoAssumido",agregadoId:c.at.id}})).toBe(2);expect(await prisma.evento.count({where:{tipo:"AriaPausadaNoAtendimento",agregadoId:c.at.id}})).toBe(2);
});
it("357 devolver à fila entre tentativas não reaproveita recibo antigo",async()=>{
 expect((await assumir(c.at.id)).ok).toBe(true);const primeira=await estado();expect((await devolverParaFila(c.at.id)).ok).toBe(true);expect((await estado()).responsavelId).toBeNull();expect((await assumir(c.at.id)).ok).toBe(true);expect((await estado()).iaPausadaEm).not.toEqual(primeira.iaPausadaEm);expect(await prisma.evento.count({where:{tipo:"AtendimentoAssumido",agregadoId:c.at.id}})).toBe(2);
});

async function esperarBloqueioNativo(){const limite=Date.now()+2500;while(Date.now()<limite){const rows=await prisma.$queryRaw<{espera:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND cardinality(pg_blocking_pids(pid))>0) AS espera`;if(rows[0].espera)return;await new Promise<void>(r=>setImmediate(r));}throw Error("Espera nativa por lock não observada");}
it("357 revogação após cancelamento real das intenções faz rollback de TODOS os efeitos",async()=>{
 const s=await sugestao();const i=await prisma.intencaoMensagem.create({data:{numeroId:c.numero.id,contatoId:c.contato.id,atendimentoId:c.at.id,origem:"IA",status:"PENDENTE",tipo:"TEXTO",corpoRenderizado:"Rollback357"}});
 depoisCancelamento=async()=>{depoisCancelamento=null;await prisma.usuario.update({where:{id:c.admin.id},data:{ativo:false}});};
 try{expect((await assumir(c.at.id)).ok).toBe(false);expect((await estado()).responsavelId).toBeNull();expect((await estado()).iaPausadaEm).toBeNull();expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:i.id}})).status).toBe("PENDENTE");expect((await prisma.acaoAgenteIA.findUniqueOrThrow({where:{id:s.id}})).status).toBe("SUGERIDA");expect(await prisma.evento.count()).toBe(0);}finally{depoisCancelamento=null;}
});
it("357 ações, intenções e responsável de OUTRO atendimento permanecem intactos",async()=>{
 await sugestao();const contato=await prisma.contatoWhatsApp.create({data:{telefoneE164:"+50680001357"}});const outro=await prisma.$transaction(tx=>garantirAtendimento(tx,{numeroId:c.numero.id,contatoId:contato.id,finalidade:"COMERCIAL"}));
 const msg=await prisma.mensagemWhatsApp.create({data:{numeroId:c.numero.id,conversaId:outro.conversaId,atendimentoId:outro.id,direcao:"ENTRADA",corpo:"Sentinela357",driver:"MOTOR"}}),t=await prisma.turnoAgenteIA.create({data:{ancoraMensagemId:msg.id,atendimentoId:outro.id,tipo:"ATENDIMENTO",resultado:"SUGERIU"}});
 const s=await prisma.acaoAgenteIA.create({data:{turnoId:t.id,atendimentoId:outro.id,acao:"RESPONDER",status:"SUGERIDA",modoConfigurado:"SUGERIR",confianca:90,payload:{texto:"Sentinela"},reversivel:false}}),i=await prisma.intencaoMensagem.create({data:{numeroId:c.numero.id,contatoId:contato.id,atendimentoId:outro.id,origem:"IA",status:"PENDENTE",tipo:"TEXTO",corpoRenderizado:"Sentinela"}});
 expect((await assumir(c.at.id)).ok).toBe(true);expect((await prisma.acaoAgenteIA.findUniqueOrThrow({where:{id:s.id}})).status).toBe("SUGERIDA");expect((await prisma.intencaoMensagem.findUniqueOrThrow({where:{id:i.id}})).status).toBe("PENDENTE");expect(await prisma.atendimentoWhatsApp.findUniqueOrThrow({where:{id:outro.id}})).toMatchObject({responsavelId:null,iaPausadaEm:null});expect(await prisma.evento.count({where:{agregadoId:outro.id}})).toBe(0);
});

async function esperarBloqueioPortal(holderPid:number){
 const fim=Date.now()+3500;
 while(Date.now()<fim){
  const[r]=await prisma.$queryRaw<{espera:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND ${holderPid}=ANY(pg_blocking_pids(pid))) AS espera`;
  if(r.espera)return;
  await new Promise<void>(resolver=>setImmediate(resolver));
 }
 throw Error("Assumir não aguardou o holder real do atendimento");
}
const casosPortal:{rotulo:string;papeis:Papel[];recusar:boolean}[]=[
 {rotulo:"ALUNO exclusivo",papeis:[Papel.ALUNO],recusar:true},
 {rotulo:"sem papéis",papeis:[],recusar:false},
 {rotulo:"ALUNO e VENDEDOR",papeis:[Papel.ALUNO,Papel.VENDEDOR],recusar:false},
];
it.each(casosPortal)("357 papel após espera $rotulo respeita apenasPortal sem alterar políticas ERP",async({papeis,recusar})=>{
 await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{responsavelId:c.admin.id,status:"EM_ATENDIMENTO",iaPausadaEm:new Date("2026-01-01T00:00:00Z"),iaPausaMotivo:"HANDOFF"}});
 await prisma.participanteAtendimentoWhatsApp.create({data:{atendimentoId:c.at.id,usuarioId:c.admin.id,concedenteId:c.admin.id,inicio:new Date(Date.now()-60000),fim:new Date(Date.now()+3600000),podeEnviar:true,motivo:"Convite legítimo de fixture portal357"}});
 const s=await sugestao(),antes=await estado();
 const whereEventos={agregadoTipo:"AtendimentoWhatsApp",agregadoId:c.at.id};
 const eventosAntes=await prisma.evento.count({where:whereEventos});
 const preso=sinal(),soltar=sinal();let pid=0;
 const holder=prisma.$transaction(async tx=>{pid=(await tx.$queryRaw<{pid:number}[]>`SELECT pg_backend_pid() AS pid`)[0].pid;await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id=${c.at.id} FOR NO KEY UPDATE`;preso.resolve();await soltar.promise;},{timeout:12000});
 let chamada:ReturnType<typeof assumir>|null=null,capacidade:boolean|null=null;
 try{
  await esperarBarreira(preso.promise);chamada=assumir(c.at.id);await esperarBloqueioPortal(pid);
  expect(papeisExternosPortal).toEqual([[Papel.ADMINISTRADOR]]);
  await prisma.usuario.update({where:{id:c.admin.id},data:{papeis}});
  const fresco=await prisma.usuario.findUniqueOrThrow({where:{id:c.admin.id},select:{id:true,nome:true,papeis:true,permissoes:true}});
  capacidade=(await carregarAriaDoAtendimento(fresco,c.at.id))?.podeAssumirAria??null;
 }finally{
  soltar.resolve();const fins=await Promise.allSettled([holder,...(chamada?[chamada]:[])]);
  for(const f of fins)if(f.status==="rejected")throw f.reason;
 }
 if(!chamada)throw Error("Action de fixture não foi iniciada");
 const r=await chamada,depois=await estado(),acao=await prisma.acaoAgenteIA.findUniqueOrThrow({where:{id:s.id}});
 if(recusar){expect(capacidade).toBe(false);expect(r.ok).toBe(false);expect(depois).toEqual(antes);expect(acao.status).toBe("SUGERIDA");expect(await prisma.evento.count({where:whereEventos})).toBe(eventosAntes);}
 else{expect(capacidade).toBe(true);expect(r.ok).toBe(true);expect(depois.iaPausaMotivo).toBe("MANUAL");expect(depois.responsavelId).toBe(c.admin.id);expect(acao.status).toBe("REJEITADA");expect(await prisma.evento.count({where:whereEventos})).toBeGreaterThan(eventosAntes);}
});
