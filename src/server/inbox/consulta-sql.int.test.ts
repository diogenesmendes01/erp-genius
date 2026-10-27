import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));vi.mock("@/lib/auth",()=>({auth:vi.fn()}));
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { escopoAtendimentos } from "@/server/whatsapp/escopo";
import { whereBuscaConversas } from "@/server/whatsapp/busca-inbox";
import { preferenciasDoUsuario } from "@/server/whatsapp/preferencias-consulta";
import { condicaoNaoLidaPessoal } from "./nao-lidas";
import { ESTADOS_ARIA, condicaoEstadoAria, carregarContextoAria } from "./estado-aria";
import { contarChipsInbox, listarAtendimentosPagina, obterItemListaInbox } from "./consultas-pagina";
import { criarOperacaoListaInbox } from "./contexto-lista";
import { resumoDaListaInbox } from "./contagens";
import { preferenciasDaPaginaSql } from "./consulta-sql";
import { AGORA344, cenarioContagens344, type Cenario344 } from "@/test/inbox-contagens-fixture";
import type { FiltrosInbox } from "./filtros";
let c:Cenario344;
beforeEach(async()=>{await truncarBanco();c=await cenarioContagens344();await prisma.acaoAgenteIA.updateMany({where:{atendimentoId:c.C.id},data:{expiraEm:null}});});
const op=(u=c.admin)=>criarOperacaoListaInbox(u,{agora:AGORA344});
async function baseOracle(u:Cenario344["admin"],f:FiltrosInbox) {
  const w:Prisma.AtendimentoWhatsAppWhereInput[]=[await escopoAtendimentos(u,{agora:AGORA344})];
  if(f.setor)w.push({finalidade:f.setor});if(f.numeroId)w.push({conversa:{numeroId:f.numeroId}});
  if(f.responsavel==="eu")w.push({responsavelId:u.id});else if(f.responsavel==="fila")w.push({responsavelId:null,encerradoEm:null});else if(f.responsavel)w.push({responsavelId:f.responsavel});
  if(f.status)w.push({status:f.status});if(f.prazoEstourado)w.push({prazoRespostaEm:{lt:AGORA344},primeiraRespostaEm:null,encerradoEm:null});
  if(f.busca)w.push(whereBuscaConversas(f.busca));if(f.naoLidas)w.push(await condicaoNaoLidaPessoal(u.id));
  if(f.aria){const ids=[c.A.id,c.B.id,c.C.id,c.D.id,c.E.id,c.F.id,c.G.id];w.push(condicaoEstadoAria(f.aria,await carregarContextoAria(prisma,{agora:AGORA344,atendimentoIds:ids})));}
  return {AND:w};
}
describe("lista344 integrada ao SQL",()=>{
  it("filtro e DTO concordam em cada estado antes de paginação",async()=>{
    for(const aria of ESTADOS_ARIA){const operacao=op();const lista=await listarAtendimentosPagina(c.admin,{aria},null,1,{operacao});const esperado=(await prisma.atendimentoWhatsApp.findMany({where:await baseOracle(c.admin,{aria}),orderBy:[{ultimaMensagemEm:{sort:"desc",nulls:"last"}},{id:"desc"}],select:{id:true}})).map(a=>a.id);
      expect(lista.itens.map(a=>a.id)).toEqual(esperado.slice(0,1));expect(lista.itens.every(a=>a.estadoAria===aria)).toBe(true);expect((await resumoDaListaInbox(c.admin,{},undefined,{operacao})).contagens[aria]).toBe(esperado.length);}
  });
  it("cinco legados conservam suas bases distintas do resumo novo",async()=>{
    const f={responsavel:"eu",naoLidas:true,prazoEstourado:true,aria:"handoff" as const};const operacao=op();
    expect(await contarChipsInbox(c.admin,f,{operacao})).toEqual({todas:1,minhas:0,naoLidas:0,prazo:0,fila:0});
    expect((await resumoDaListaInbox(c.admin,f,undefined,{operacao})).contagens.todas).toBe(0);
    const norm={...f,responsavel:undefined,naoLidas:undefined,prazoEstourado:undefined};expect((await contarChipsInbox(c.admin,f,{operacao})).todas).toBe(await prisma.atendimentoWhatsApp.count({where:await baseOracle(c.admin,norm)}));
  });
  it("montagem não duplica global entre lista/resumos/deep link concorrentes",async()=>{
    const operacao=op(),agente=vi.spyOn(prisma.agenteIA,"findUnique"),cfg=vi.spyOn(prisma.configIA,"upsert");
    try{await Promise.all([listarAtendimentosPagina(c.admin,{},null,2,{operacao}),contarChipsInbox(c.admin,{}, {operacao}),resumoDaListaInbox(c.admin,{},undefined,{operacao}),obterItemListaInbox(c.admin,c.A.id,{operacao})]);expect(agente).toHaveBeenCalledTimes(1);expect(cfg).toHaveBeenCalledTimes(1);}
    finally{agente.mockRestore();cfg.mockRestore();}
  });
  it("snapshot pessoal limitado tem paridade e uma query com instantes distintos",async()=>{
    const ids=[c.A.id,c.B.id,c.C.id,c.D.id];await prisma.atendimentoWhatsApp.update({where:{id:c.A.id},data:{naoLidas:3}});
    await prisma.preferenciaConversaUsuario.createMany({data:[{usuarioId:c.admin.id,conversaId:c.A.conversaId,fixadaEm:AGORA344},{usuarioId:c.admin.id,conversaId:c.B.conversaId,lidaAte:new Date(AGORA344.getTime()-10),silenciadaAte:new Date(AGORA344.getTime()+1)},{usuarioId:c.admin.id,conversaId:c.C.conversaId,lidaAte:new Date(AGORA344.getTime()-20),marcadaNaoLida:true},{usuarioId:c.outro.id,conversaId:c.D.conversaId,marcadaNaoLida:true}]});
    await prisma.mensagemWhatsApp.create({data:{atendimentoId:c.B.id,conversaId:c.B.conversaId,numeroId:c.numero.id,direcao:"ENTRADA",corpo:"fixture",criadoEm:AGORA344,driver:"MOTOR",status:"ENTREGUE"}});
    vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(AGORA344);
    try{const esperado=await preferenciasDoUsuario(c.admin.id,ids),raw=vi.spyOn(prisma,"$queryRaw");try{expect(await preferenciasDaPaginaSql(prisma,c.admin.id,ids,AGORA344)).toEqual(esperado);expect(raw).toHaveBeenCalledTimes(1);expect(JSON.stringify(raw.mock.calls)).not.toContain(c.G.id);}finally{raw.mockRestore();}}
    finally{vi.useRealTimers();}
  });
  it("hidratação reaplica ACL e não transforma ID selecionado em permissão",async()=>{
    const original=prisma.atendimentoWhatsApp.findMany.bind(prisma.atendimentoWhatsApp);let mudou=false;
    const spy=vi.spyOn(prisma.atendimentoWhatsApp,"findMany").mockImplementation((async (args:Prisma.AtendimentoWhatsAppFindManyArgs|undefined)=>{if(!mudou){mudou=true;await prisma.oportunidade.update({where:{id:c.B.leadId!},data:{vendedorDonoId:c.outro.id}});}return original(args as never) as never;}) as never);
    try{const r=await listarAtendimentosPagina(c.vendedor,{},null,50,{operacao:op(c.vendedor)});expect(r.itens.map(a=>a.id)).not.toContain(c.B.id);expect(r.itens.map(a=>a.id)).toContain(c.D.id);}finally{spy.mockRestore();}
  });
  it("pool1 usa Db recebido em seleção/snapshot/montagem sem leitura global",async()=>{
    const url=new URL(process.env.DATABASE_URL!);url.searchParams.set("connection_limit","1");const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
    try{await expect(db.$transaction(async tx=>{await tx.oportunidade.update({where:{id:c.A.leadId!},data:{vendedorDonoId:c.vendedor.id}});const operacao=criarOperacaoListaInbox(c.vendedor,{db:tx,agora:AGORA344});expect((await listarAtendimentosPagina(c.vendedor,{},null,50,{operacao})).itens.map(a=>a.id)).toContain(c.A.id);throw Error("ROLLBACK_LISTA344");},{timeout:15000})).rejects.toThrow("ROLLBACK_LISTA344");expect((await db.oportunidade.findUniqueOrThrow({where:{id:c.A.leadId!}})).vendedorDonoId).toBe(c.outro.id);}finally{await db.$disconnect();}
  });
});
it("aria e prazo alcançam alvo após305 linhas, com cursor nulo/empates e mais100fixadas",async()=>{
  const ids=Array.from({length:305},(_,i)=>"344-volume-"+String(i).padStart(4,"0"));
  await prisma.contatoWhatsApp.createMany({data:ids.map((id,i)=>({id:id+"-ct",telefoneE164:"+506944"+String(i).padStart(5,"0")}))});
  await prisma.conversaWhatsApp.createMany({data:ids.map(id=>({id:id+"-cv",numeroId:c.numero.id,contatoId:id+"-ct"}))});
  await prisma.atendimentoWhatsApp.createMany({data:ids.map((id,i)=>({id,conversaId:id+"-cv",contextoChave:id,finalidade:"COMERCIAL",ultimaMensagemEm:new Date(AGORA344.getTime()+Math.floor(i/2)*1000)}))});
  expect((await listarAtendimentosPagina(c.admin,{},null,200,{operacao:op()})).itens.map(a=>a.id)).not.toContain(c.D.id);
  expect((await listarAtendimentosPagina(c.admin,{aria:"handoff"},null,200,{operacao:op()})).itens.map(a=>a.id)).toEqual([c.D.id]);
  expect((await listarAtendimentosPagina(c.admin,{prazoEstourado:true},null,200,{operacao:op()})).itens.map(a=>a.id)).toEqual([c.F.id]);
  const primeira=await listarAtendimentosPagina(c.admin,{aria:"ia"},null,200,{operacao:op()});
  const segunda=await listarAtendimentosPagina(c.admin,{aria:"ia"},primeira.proximo,200,{operacao:op()});
  const oracle=await prisma.atendimentoWhatsApp.findMany({where:await baseOracle(c.admin,{aria:"ia"}),orderBy:[{ultimaMensagemEm:{sort:"desc",nulls:"last"}},{id:"desc"}],select:{id:true}});
  expect(primeira.itens).toHaveLength(200);expect(segunda.itens).toHaveLength(107);expect(segunda.proximo).toBeNull();expect([...primeira.itens,...segunda.itens].map(a=>a.id)).toEqual(oracle.map(a=>a.id));
  await prisma.preferenciaConversaUsuario.createMany({data:ids.slice(0,105).map(id=>({usuarioId:c.admin.id,conversaId:id+"-cv",fixadaEm:AGORA344}))});
  const p=await listarAtendimentosPagina(c.admin,{},null,200,{operacao:op()}),q=await listarAtendimentosPagina(c.admin,{},p.proximo,200,{operacao:op()});
  expect(p.itens.filter(a=>a.fixada)).toHaveLength(100);expect(p.itens).toHaveLength(300);expect(q.itens).toHaveLength(7);expect(q.itens.every(a=>!a.fixada)).toBe(true);expect(q.proximo).toBeNull();expect(new Set([...p.itens,...q.itens].map(a=>a.id)).size).toBe(307);
},60000);
