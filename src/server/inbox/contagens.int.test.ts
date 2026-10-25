import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));vi.mock("@/lib/auth",()=>({auth:vi.fn()}));
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { escopoAtendimentos } from "@/server/whatsapp/escopo";
import { condicaoNaoLidaPessoal } from "./nao-lidas";
import { carregarContextoListaInbox, resumoComContexto, resumoDaListaInbox } from "./contagens";
import { AGORA344, cenarioContagens344, sugestao344, type Cenario344 } from "@/test/inbox-contagens-fixture";
let c:Cenario344;
const totais={todas:7,ia:2,aprovacao:1,handoff:1,humano:2,semResposta:1,naoAtribuidas:3};
beforeEach(async()=>{await truncarBanco();c=await cenarioContagens344();});
const ler=(f:Parameters<typeof resumoDaListaInbox>[1]={})=>resumoDaListaInbox(c.admin,f,AGORA344);
describe("sete contagens SQL344",()=>{
  it("A–G no escopo e FINANCEIRO Admin=1",async()=>{
    expect(await ler()).toEqual({contagens:totais,aria:{estado:"ATIVA",pausada:false,podeGerenciar:true}});
    expect((await ler({setor:"FINANCEIRO"})).contagens).toEqual({todas:1,ia:0,aprovacao:0,handoff:0,humano:1,semResposta:0,naoAtribuidas:0});
    expect((await resumoDaListaInbox(c.vendedor,{},AGORA344))).toEqual({contagens:{todas:2,ia:1,aprovacao:0,handoff:1,humano:0,semResposta:0,naoAtribuidas:0},aria:{estado:"ATIVA",pausada:false,podeGerenciar:false}});
  });
  it("base remove aria/prazo/fila, mantém eu/ID/setor/número/busca/status",async()=>{
    expect(await ler({aria:"handoff",prazoEstourado:true,responsavel:"fila"})).toEqual(await ler());
    expect((await ler({responsavel:"eu"})).contagens).toMatchObject({todas:2,humano:2,ia:0,handoff:0});
    expect((await ler({responsavel:c.vendedor.id})).contagens).toMatchObject({todas:2,ia:1,handoff:1});
    expect((await ler({numeroId:"ausente"})).contagens.todas).toBe(0);expect((await ler({busca:"Contato A"})).contagens.todas).toBe(7);
    expect((await ler({busca:"80000065"})).contagens.todas).toBe(1);expect((await ler({busca:"INEXISTENTE344"})).contagens.todas).toBe(0);
    expect((await ler({status:"ENCERRADO"})).contagens.todas).toBe(0);
  });
  it("não lidas pessoais por EXISTS preservam todos os ramos, não o compartilhado",async()=>{
    await prisma.atendimentoWhatsApp.update({where:{id:c.A.id},data:{naoLidas:2}});await prisma.atendimentoWhatsApp.update({where:{id:c.B.id},data:{naoLidas:5}});await prisma.atendimentoWhatsApp.update({where:{id:c.D.id},data:{naoLidas:1}});
    await prisma.preferenciaConversaUsuario.createMany({data:[{usuarioId:c.admin.id,conversaId:c.B.conversaId,lidaAte:new Date(AGORA344.getTime()+1)},{usuarioId:c.admin.id,conversaId:c.C.conversaId,marcadaNaoLida:true,lidaAte:new Date(AGORA344.getTime()+1)},{usuarioId:c.outro.id,conversaId:c.D.conversaId,lidaAte:new Date(AGORA344.getTime()+1)},{usuarioId:c.admin.id,conversaId:c.E.conversaId,lidaAte:new Date(AGORA344.getTime()-2)}]});
    const entrada=await prisma.mensagemWhatsApp.create({data:{atendimentoId:c.E.id,conversaId:c.E.conversaId,numeroId:c.numero.id,direcao:"ENTRADA",corpo:"fixture",driver:"MOTOR",status:"ENTREGUE",criadoEm:new Date(AGORA344.getTime()-1)}});
    const r=await ler({naoLidas:true});expect(r.contagens).toEqual({todas:4,ia:1,aprovacao:1,handoff:1,humano:1,semResposta:0,naoAtribuidas:2});
    const oracle=await prisma.atendimentoWhatsApp.count({where:{AND:[await escopoAtendimentos(c.admin,{agora:AGORA344}),await condicaoNaoLidaPessoal(c.admin.id)]}});expect(r.contagens.todas).toBe(oracle);
    expect((await resumoDaListaInbox(c.outro,{naoLidas:true},AGORA344)).contagens.todas).toBe(1);
    await prisma.mensagemWhatsApp.update({where:{id:entrada.id},data:{criadoEm:new Date(AGORA344.getTime()-2)}});expect((await ler({naoLidas:true})).contagens.todas).toBe(3);
    await prisma.mensagemWhatsApp.update({where:{id:entrada.id},data:{criadoEm:new Date(AGORA344.getTime()-1)}});expect((await ler({naoLidas:true})).contagens.todas).toBe(4);
  });
  it("prazo é estrito, primeira resposta/encerramento excluem SLA e todas inclui NULL",async()=>{
    for(const ms of [-1,0,1]){await prisma.atendimentoWhatsApp.update({where:{id:c.F.id},data:{prazoRespostaEm:new Date(AGORA344.getTime()+ms)}});expect((await ler()).contagens.semResposta).toBe(ms<0?1:0);}
    await prisma.atendimentoWhatsApp.update({where:{id:c.F.id},data:{prazoRespostaEm:new Date(AGORA344.getTime()-1),primeiraRespostaEm:AGORA344}});expect((await ler()).contagens.semResposta).toBe(0);
    await prisma.atendimentoWhatsApp.update({where:{id:c.F.id},data:{status:"ENCERRADO",encerradoEm:AGORA344}});
    expect((await ler({status:"ENCERRADO"})).contagens).toEqual({todas:1,ia:0,aprovacao:0,handoff:0,humano:0,semResposta:0,naoAtribuidas:0});expect((await ler()).contagens.todas).toBe(7);
  });
  it("múltiplas sugestões/eventos não multiplicam os sete totais",async()=>{
    await sugestao344(c,c.C.id,null);await sugestao344(c,c.C.id,null);
    await prisma.evento.createMany({data:Array.from({length:3},()=>({tipo:"AtendimentoAssumido",agregadoTipo:"AtendimentoWhatsApp",agregadoId:c.D.id,autorId:c.admin.id,payload:{},criadoEm:new Date(AGORA344.getTime()-1000)}))});
    expect((await ler()).contagens).toEqual(totais);
  });
  it("situação, orçamento e ACL uma carga; uma query agregada e contexto reutilizável",async()=>{
    const raw=vi.spyOn(prisma,"$queryRaw"),agente=vi.spyOn(prisma.agenteIA,"findUnique"),orc=vi.spyOn(prisma.configIA,"upsert"),versao=vi.spyOn(prisma.versaoAgenteIA,"findFirst");
    try{const ctx=await carregarContextoListaInbox(prisma,c.admin,AGORA344);expect((await resumoComContexto(ctx,{})).contagens).toEqual(totais);expect(raw).toHaveBeenCalledTimes(1);expect(agente).toHaveBeenCalledTimes(1);expect(orc).toHaveBeenCalledTimes(1);expect(versao).toHaveBeenCalledTimes(1);
      expect((await resumoComContexto(ctx,{})).contagens).toEqual(totais);expect(raw).toHaveBeenCalledTimes(2);expect(agente).toHaveBeenCalledTimes(1);expect(orc).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(raw.mock.calls)).not.toContain("SEGREDO344");
    }finally{raw.mockRestore();agente.mockRestore();orc.mockRestore();versao.mockRestore();}
  });
  it("estado bruto da faixa não confunde orçamento/global efetivo",async()=>{
    await prisma.configIA.update({where:{id:"ia"},data:{orcamentoMensalUsd:0,acaoAoEstourar:"PAUSAR"}});expect((await ler()).contagens.ia).toBe(0);expect((await ler()).aria).toEqual({estado:"ATIVA",pausada:false,podeGerenciar:true});
    await prisma.configIA.update({where:{id:"ia"},data:{acaoAoEstourar:"SO_SUGERIR"}});expect((await ler()).contagens.ia).toBe(2);
    await prisma.agenteIA.update({where:{id:"aria"},data:{pausadoEm:AGORA344}});expect((await ler()).contagens.ia).toBe(0);expect((await ler()).aria.pausada).toBe(true);
  });
  it("sem versão ou SHADOW não classifica IA; zero fora dos filtros não inicializa H",async()=>{
    await prisma.versaoAgenteIA.deleteMany();expect((await ler()).contagens.ia).toBe(0);
    await prisma.agenteIA.update({where:{id:"aria"},data:{estado:"SHADOW"}});expect((await ler()).aria.estado).toBe("SHADOW");
    expect((await ler({numeroId:"ausente"})).contagens).toEqual({todas:0,ia:0,aprovacao:0,handoff:0,humano:0,semResposta:0,naoAtribuidas:0});
  });
  it("mais de300 handoffs não têm cap nem consultas por atendimento",async()=>{
    const ids=Array.from({length:301},(_,n)=>"344-m2-"+n);
    await prisma.contatoWhatsApp.createMany({data:ids.map((id,n)=>({id:"ct-"+id,telefoneE164:"+5069"+String(n).padStart(7,"0")}))});
    await prisma.conversaWhatsApp.createMany({data:ids.map(id=>({id:"cv-"+id,numeroId:c.numero.id,contatoId:"ct-"+id}))});
    await prisma.atendimentoWhatsApp.createMany({data:ids.map(id=>({id,conversaId:"cv-"+id,contextoChave:id,finalidade:"COMERCIAL",iaPausadaEm:AGORA344,iaPausaMotivo:"HANDOFF"}))});
    const raw=vi.spyOn(prisma,"$queryRaw");try{expect((await ler()).contagens).toEqual({...totais,todas:308,handoff:302,naoAtribuidas:304});expect(raw).toHaveBeenCalledTimes(1);}finally{raw.mockRestore();}
  });
  it("pool1 mantém contexto/carteira/global não commitados no mesmo Db e rollback",async()=>{
    const url=new URL(process.env.DATABASE_URL!);url.searchParams.set("connection_limit","1");const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
    try{await expect(db.$transaction(async tx=>{await tx.oportunidade.update({where:{id:c.A.leadId!},data:{vendedorDonoId:c.vendedor.id}});await tx.agenteIA.update({where:{id:"aria"},data:{pausadoEm:AGORA344}});
      expect((await resumoDaListaInbox(c.vendedor,{},AGORA344,{db:tx})).contagens).toMatchObject({todas:3,ia:0,handoff:1,humano:1});throw Error("ROLLBACK_CONTAGENS344");},{timeout:15000})).rejects.toThrow("ROLLBACK_CONTAGENS344");
      expect((await resumoDaListaInbox(c.vendedor,{},AGORA344,{db})).contagens.todas).toBe(2);expect((await db.agenteIA.findUniqueOrThrow({where:{id:"aria"}})).pausadoEm).toBeNull();
    }finally{await db.$disconnect();}
  });
  it("envio usa a mesma ACL e prazo em três TZ é consistente",async()=>{
    await prisma.numeroWhatsApp.update({where:{id:c.numero.id},data:{ativo:false}});expect((await resumoDaListaInbox(c.admin,{},AGORA344,{enviar:true})).contagens.todas).toBe(0);expect((await ler()).contagens.todas).toBe(7);
    await prisma.$transaction(async tx=>{const [antes]=await tx.$queryRaw<{tz:string}[]>`SELECT current_setting('TimeZone') AS tz`;
      try{for(const tz of ["UTC","America/Sao_Paulo","Asia/Tokyo"]){await tx.$queryRaw`SELECT set_config('TimeZone',${tz},true)`;expect((await resumoDaListaInbox(c.admin,{},AGORA344,{db:tx})).contagens).toEqual(totais);}}
      finally{await tx.$queryRaw`SELECT set_config('TimeZone',${antes.tz},true)`;}
    },{timeout:15000});
  });
});
