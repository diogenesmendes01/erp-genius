import { DriverWhatsApp, type Prisma, type StatusAcaoAgenteIA } from "@prisma/client";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { assinarInbox, iniciarEscuta, esperaReconexaoMs, CANAL_INBOX, avisarAtendimentoAtualizado, type AvisoInbox } from "./barramento";

let a: { id: string; conversaId: string }; let numeroId: string;

beforeAll(async () => { await iniciarEscuta(process.env.DATABASE_URL!); });
beforeEach(async () => {
  await truncarBanco();
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511999999999", rotulo: "Inst", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS" } });
  numeroId = numero.id;
  const lead = await prisma.oportunidade.create({ data: { nome: "Maria", telefoneE164: "+50688888888" } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688888888", leadId: lead.id } });
  a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id }));
});
afterAll(() => prisma.$disconnect());

const criarMensagemEntrada = (corpo: string) => prisma.mensagemWhatsApp.create({ data: { numeroId, conversaId: a.conversaId, atendimentoId: a.id, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, corpo } });
const escutar = () => { const r: AvisoInbox[] = []; const sair = assinarInbox((x) => r.push(x)); return { r, sair }; };
const pausa = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

describe("barramento do inbox", () => {
  it("iniciarEscuta é idempotente", async () => {
    await iniciarEscuta(process.env.DATABASE_URL!); await iniciarEscuta();
  });
  it("insert de mensagem gera aviso sem conteúdo, depois do commit", async () => {
    const { r, sair } = escutar();
    const m = await criarMensagemEntrada("segredo");
    await vi.waitFor(() => expect(r).toContainEqual({ tipo: "mensagem.nova", atendimentoId: a.id, mensagemId: m.id, conversaId: a.conversaId }), { timeout: 2000 });
    expect(JSON.stringify(r)).not.toContain("segredo"); sair();
  });
  it("rollback não avisa", async () => {
    const { r, sair } = escutar();
    await expect(prisma.$transaction(async (tx) => {
      await tx.mensagemWhatsApp.create({ data: { numeroId, conversaId: a.conversaId, atendimentoId: a.id, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, corpo: "x" } });
      throw new Error("desfaz");
    })).rejects.toThrow("desfaz");
    await pausa(500); expect(r).toEqual([]); sair();
  });
  it("update de status da mensagem → mensagem.status; update do atendimento → atendimento.atualizado", async () => {
    const m = await criarMensagemEntrada("oi"); await pausa(300);
    const { r, sair } = escutar();
    await prisma.mensagemWhatsApp.update({ where: { id: m.id }, data: { status: "LIDA" } });
    await vi.waitFor(() => expect(r).toContainEqual({ tipo: "mensagem.status", atendimentoId: a.id, mensagemId: m.id, conversaId: a.conversaId }), { timeout: 2000 });
    await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { naoLidas: 3 } });
    await vi.waitFor(() => expect(r).toContainEqual({ tipo: "atendimento.atualizado", atendimentoId: a.id, mensagemId: null, conversaId: a.conversaId }), { timeout: 2000 });
    sair();
  });
  it("reclassificar a mensagem (atendimentoId) → atendimento.atualizado", async () => {
    const m = await prisma.mensagemWhatsApp.create({ data: { numeroId, conversaId: a.conversaId, direcao: "ENTRADA", driver: DriverWhatsApp.BAILEYS, corpo: "oi" } });
    await pausa(300);
    const { r, sair } = escutar();
    await prisma.mensagemWhatsApp.update({ where: { id: m.id }, data: { atendimentoId: a.id } });
    await vi.waitFor(() => expect(r).toContainEqual({ tipo: "atendimento.atualizado", atendimentoId: a.id, mensagemId: m.id, conversaId: a.conversaId }), { timeout: 2000 });
    sair();
  });
  it("C5: ao reconectar o LISTEN emite resync às assinaturas (e não na primeira conexão)", async () => {
    const { r, sair } = escutar();
    expect(r.filter((x) => x.tipo === "resync")).toHaveLength(0);
    const mortos = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(pg_terminate_backend(pid))::int AS n FROM pg_stat_activity
       WHERE datname = current_database() AND pid <> pg_backend_pid() AND query LIKE 'LISTEN inbox_eventos%'`);
    expect(mortos[0].n).toBeGreaterThan(0);
    await vi.waitFor(() => expect(r).toContainEqual({ tipo: "resync", atendimentoId: null, mensagemId: null, conversaId: "" }), { timeout: 8000 });
    const m = await criarMensagemEntrada("depois");
    await vi.waitFor(() => expect(r).toContainEqual({ tipo: "mensagem.nova", atendimentoId: a.id, mensagemId: m.id, conversaId: a.conversaId }), { timeout: 3000 });
    sair();
  });
  it("espera de reconexão: 1 s, 2 s, 4 s… até 30 s", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9].map(esperaReconexaoMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
});

let cerca345:Client,turno345:string,seq345=0;
function deferred345(){let resolver!:()=>void;const promessa=new Promise<void>(r=>{resolver=r;});return{promessa,resolver};}
async function drenar345(){
  const sentinela:AvisoInbox={tipo:"atendimento.atualizado",atendimentoId:"__barreira345_"+(++seq345),mensagemId:null,conversaId:""};
  const {r,sair}=escutar();
  try{await cerca345.query("SELECT pg_notify($1,$2)",[CANAL_INBOX,JSON.stringify(sentinela)]);await vi.waitFor(()=>expect(r).toContainEqual(sentinela),{timeout:2000});}
  finally{sair();}
}
async function turnoPara345(at:{id:string;conversaId:string}){
  const ancora=await prisma.mensagemWhatsApp.create({data:{numeroId,conversaId:at.conversaId,atendimentoId:at.id,direcao:"ENTRADA",driver:"MOTOR",corpo:"Ancora fake345",status:"ENTREGUE"}});
  return prisma.turnoAgenteIA.create({data:{ancoraMensagemId:ancora.id,atendimentoId:at.id,tipo:"ATENDIMENTO",resultado:"SUGERIU"}});
}
function acao345(db:Prisma.TransactionClient=prisma,status:StatusAcaoAgenteIA="SUGERIDA",alvo=a,t=turno345){
  return db.acaoAgenteIA.create({data:{turnoId:t,atendimentoId:alvo.id,acao:"NOTA_INTERNA",modoConfigurado:"SUGERIR",status,confianca:70,payload:{texto:"SEGREDO345"},reversivel:true}});
}
const avisoAlvo345=(alvo=a):AvisoInbox=>({tipo:"atendimento.atualizado",atendimentoId:alvo.id,mensagemId:null,conversaId:alvo.conversaId});
const avisosAlvo345=(r:AvisoInbox[],alvo=a)=>r.filter(x=>x.tipo==="atendimento.atualizado"&&x.atendimentoId===alvo.id);
const globais345=(r:AvisoInbox[])=>r.filter(x=>x.tipo==="aria.global");
const global345:AvisoInbox={tipo:"aria.global",atendimentoId:null,mensagemId:null,conversaId:""};

describe("#345 notificações de ações e estado global",()=>{
  beforeAll(async()=>{cerca345=new Client({connectionString:process.env.DATABASE_URL!});await cerca345.connect();});
  afterAll(async()=>{await cerca345?.end();});
  beforeEach(async()=>{
    await prisma.numeroWhatsApp.update({where:{id:numeroId},data:{driver:"MOTOR"}});
    turno345=(await turnoPara345(a)).id;
    await prisma.agenteIA.create({data:{id:"aria",estado:"DESLIGADA"}});
    await drenar345();
  });
  it("INSERT SUGERIDA avisa só IDs depois da escrita",async()=>{
    const {r,sair}=escutar();try{await acao345();await vi.waitFor(()=>expect(avisosAlvo345(r)).toEqual([avisoAlvo345()]),{timeout:2000});expect(JSON.stringify(avisosAlvo345(r))).not.toContain("SEGREDO345");expect(Object.keys(avisosAlvo345(r)[0]).sort()).toEqual(["atendimentoId","conversaId","mensagemId","tipo"]);}finally{sair();}
  });
  it.each(["APROVADA","REJEITADA","EXPIRADA","DESFEITA"] as const)("mudança real de status para %s avisa",async status=>{
    const acao=await acao345(prisma,status==="DESFEITA"?"APROVADA":"SUGERIDA");await drenar345();const {r,sair}=escutar();
    try{await prisma.acaoAgenteIA.update({where:{id:acao.id},data:{status}});await vi.waitFor(()=>expect(avisosAlvo345(r)).toEqual([avisoAlvo345()]),{timeout:2000});}finally{sair();}
  });
  it("status igual, confiança e payload isolados não avisam",async()=>{
    const acao=await acao345();await drenar345();const {r,sair}=escutar();try{await prisma.acaoAgenteIA.update({where:{id:acao.id},data:{status:"SUGERIDA"}});await prisma.acaoAgenteIA.update({where:{id:acao.id},data:{confianca:71,payload:{texto:"outro segredo"}}});await drenar345();expect(avisosAlvo345(r)).toEqual([]);}finally{sair();}
  });
  it("CLASSIFICAR_SETOR SIMULADA sem atendimento não avisa",async()=>{
    const ancora=await prisma.mensagemWhatsApp.create({data:{numeroId,conversaId:a.conversaId,direcao:"ENTRADA",driver:"MOTOR",corpo:"Triagem fake345"}});
    const t=await prisma.turnoAgenteIA.create({data:{ancoraMensagemId:ancora.id,tipo:"TRIAGEM",resultado:"SIMULOU"}});await drenar345();const {r,sair}=escutar();
    try{await prisma.acaoAgenteIA.create({data:{turnoId:t.id,acao:"CLASSIFICAR_SETOR",modoConfigurado:"SHADOW",status:"SIMULADA",confianca:80,payload:{setor:"COMERCIAL"},reversivel:false}});await drenar345();expect(r.filter(x=>!x.atendimentoId?.startsWith("__barreira345_"))).toEqual([]);}finally{sair();}
  });
  it("INSERT EXECUTADA com atendimento também avisa",async()=>{
    const {r,sair}=escutar();try{await acao345(prisma,"EXECUTADA");await vi.waitFor(()=>expect(avisosAlvo345(r)).toEqual([avisoAlvo345()]),{timeout:2000});}finally{sair();}
  });
  it("ações SQL do mesmo atendimento coalescem na mesma transação",async()=>{
    const {r,sair}=escutar();try{await prisma.$transaction(async tx=>{await acao345(tx);await acao345(tx);});await drenar345();expect(avisosAlvo345(r)).toEqual([avisoAlvo345()]);}finally{sair();}
  });
  it("ações de dois atendimentos não se misturam",async()=>{
    const lead=await prisma.oportunidade.create({data:{nome:"Fake345B"}}),contato=await prisma.contatoWhatsApp.create({data:{telefoneE164:"+506000003452",leadId:lead.id}});
    const b=await prisma.$transaction(tx=>garantirAtendimento(tx,{numeroId,contatoId:contato.id,finalidade:"COMERCIAL",leadId:lead.id})),t=await turnoPara345(b);await drenar345();const {r,sair}=escutar();
    try{await prisma.$transaction(async tx=>{await acao345(tx);await acao345(tx,"SUGERIDA",b,t.id);});await drenar345();expect(avisosAlvo345(r)).toEqual([avisoAlvo345()]);expect(avisosAlvo345(r,b)).toEqual([avisoAlvo345(b)]);}finally{sair();}
  });
  it("ação fica invisível ao LISTEN até o commit real",async()=>{
    const gravou=deferred345(),liberar=deferred345(),{r,sair}=escutar();
    const terminado=prisma.$transaction(async tx=>{await acao345(tx);gravou.resolver();await liberar.promessa;},{timeout:15000});
    try{await Promise.race([gravou.promessa,terminado]);await drenar345();expect(avisosAlvo345(r)).toEqual([]);liberar.resolver();await terminado;await vi.waitFor(()=>expect(avisosAlvo345(r)).toEqual([avisoAlvo345()]),{timeout:2000});}
    finally{liberar.resolver();await terminado.catch(()=>{});sair();}
  });
  it("rollback da ação não avisa, com barreira posterior positiva",async()=>{
    const {r,sair}=escutar();try{await expect(prisma.$transaction(async tx=>{await acao345(tx);throw Error("ROLLBACK_ACAO345");})).rejects.toThrow("ROLLBACK_ACAO345");await drenar345();expect(avisosAlvo345(r)).toEqual([]);}finally{sair();}
  });
  it("AgenteIA INSERT e updates sem mudança operacional não avisam",async()=>{
    await prisma.agenteIA.delete({where:{id:"aria"}});await drenar345();
    const {r,sair}=escutar();try{await prisma.agenteIA.create({data:{id:"aria",estado:"DESLIGADA"}});await prisma.agenteIA.upsert({where:{id:"aria"},create:{id:"aria"},update:{}});await prisma.agenteIA.update({where:{id:"aria"},data:{estado:"DESLIGADA",pausadoEm:null,motivoPausa:"SEGREDO345",supervisaoAte:new Date("2026-10-25T12:00:00Z")}});await drenar345();expect(globais345(r)).toEqual([]);}finally{sair();}
  });
  it.each(["pausar","reativar","estado"] as const)("%s global avisa contrato vazio e sem motivo",async modo=>{
    if(modo==="reativar"){await prisma.agenteIA.update({where:{id:"aria"},data:{pausadoEm:new Date("2026-10-25T02:00:00Z")}});await drenar345();}
    const {r,sair}=escutar();try{await prisma.agenteIA.update({where:{id:"aria"},data:modo==="estado"?{estado:"SHADOW"}:{pausadoEm:modo==="pausar"?new Date("2026-10-25T02:00:00Z"):null,motivoPausa:modo==="pausar"?"SEGREDO345":null}});await vi.waitFor(()=>expect(globais345(r)).toEqual([global345]),{timeout:2000});expect(JSON.stringify(globais345(r))).not.toContain("SEGREDO345");}finally{sair();}
  });
  it("updates globais reais coalescem numa transação",async()=>{
    const {r,sair}=escutar();try{await prisma.$transaction(async tx=>{await tx.agenteIA.update({where:{id:"aria"},data:{estado:"SHADOW"}});await tx.agenteIA.update({where:{id:"aria"},data:{estado:"ATIVA"}});});await drenar345();expect(globais345(r)).toEqual([global345]);}finally{sair();}
  });
  it("rollback global não avisa",async()=>{
    const {r,sair}=escutar();try{await expect(prisma.$transaction(async tx=>{await tx.agenteIA.update({where:{id:"aria"},data:{pausadoEm:new Date()}});throw Error("ROLLBACK_GLOBAL345");})).rejects.toThrow("ROLLBACK_GLOBAL345");await drenar345();expect(globais345(r)).toEqual([]);}finally{sair();}
  });
  it("aviso manual existente pode coexistir; não se presume dedup universal",async()=>{
    const {r,sair}=escutar();try{await prisma.$transaction(async tx=>{await acao345(tx);await avisarAtendimentoAtualizado(tx,a);});await drenar345();const avisos=avisosAlvo345(r);expect(avisos.length).toBeGreaterThanOrEqual(1);for(const aviso of avisos)expect(aviso).toEqual(avisoAlvo345());}finally{sair();}
  });
});
