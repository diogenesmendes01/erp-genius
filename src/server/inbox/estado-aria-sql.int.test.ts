import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));vi.mock("@/lib/auth",()=>({auth:vi.fn()}));
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import type { Db } from "@/server/whatsapp/escopo";
import { carregarContextoAria, condicaoEstadoAria, derivarEstadoAria, ESTADOS_ARIA, linhaEstadoDe, sugestaoVigente } from "./estado-aria";
import { estadoAriaEmSql, RELACOES_ESTADO_ARIA } from "./estado-aria-sql";
import { AGORA344, cenarioContagens344, sugestao344, type Cenario344 } from "./contagens-fixture.int";
let c:Cenario344;
beforeEach(async()=>{await truncarBanco();c=await cenarioContagens344();});
async function paridade(db:Db=prisma,ativa=true) {
  const linhas=await db.atendimentoWhatsApp.findMany({include:{conversa:{include:{numero:true,contato:true}}}});
  const ids=linhas.map(a=>a.id), carregado=await carregarContextoAria(db,{atendimentoIds:ids,agora:AGORA344}),ctx={...carregado,ariaAtiva:ativa};
  const sugestoes=new Set((await db.acaoAgenteIA.findMany({where:sugestaoVigente(AGORA344),select:{atendimentoId:true}})).map(s=>s.atendimentoId));
  const esperados=linhas.map(a=>({id:a.id,estado:derivarEstadoAria(linhaEstadoDe(a),ctx,sugestoes.has(a.id))})).sort((x,y)=>x.id.localeCompare(y.id));
  const sql=await db.$queryRaw<{id:string;estado:string|null}[]>(Prisma.sql`SELECT a."id",${estadoAriaEmSql(ativa,AGORA344)} AS estado FROM "AtendimentoWhatsApp" a ${RELACOES_ESTADO_ARIA} ORDER BY a."id"`);
  expect(sql).toEqual(esperados);
  for(const e of ESTADOS_ARIA){const prismaIds=(await db.atendimentoWhatsApp.findMany({where:condicaoEstadoAria(e,ctx),select:{id:true}})).map(a=>a.id).sort();expect(sql.filter(a=>a.estado===e).map(a=>a.id)).toEqual(prismaIds);}
  return new Map(sql.map(a=>[a.id,a.estado]));
}
describe("paridade EstadoAria SQL344",()=>{
  it.each([true,false])("CASE concorda com derivação e condições342, global=%s",async ativa=>{await paridade(prisma,ativa);});
  it("H vence pausa e sugestão; pausa vence sugestão; encerrado e optout são preservados",async()=>{
    await sugestao344(c,c.D.id);await sugestao344(c,c.E.id);
    await prisma.atendimentoWhatsApp.update({where:{id:c.C.id},data:{status:"ENCERRADO",encerradoEm:AGORA344}});
    await prisma.contatoWhatsApp.update({where:{id:(await prisma.conversaWhatsApp.findUniqueOrThrow({where:{id:c.A.conversaId}})).contatoId!},data:{optOutEm:AGORA344}});
    const r=await paridade();expect(r.get(c.D.id)).toBe("handoff");expect(r.get(c.E.id)).toBe("humano");expect(r.get(c.C.id)).toBeNull();expect(r.get(c.A.id)).toBeNull();
  });
  it("linha com dono bloqueia IA mesmo ativa, preservando fallback humano",async()=>{
    const numero=await prisma.numeroWhatsApp.create({data:{telefoneE164:"+50670000349",rotulo:"Linha344",driver:"MOTOR",finalidade:"VENDAS",donoId:c.admin.id}});
    const contato=await prisma.contatoWhatsApp.create({data:{telefoneE164:"+50680000349"}});const conversa=await prisma.conversaWhatsApp.create({data:{numeroId:numero.id,contatoId:contato.id}});
    const a=await prisma.atendimentoWhatsApp.create({data:{conversaId:conversa.id,contextoChave:"linha344",finalidade:"COMERCIAL",responsavelId:c.admin.id}});
    expect((await paridade()).get(a.id)).toBe("humano");
  });
  it.each(["HUMANO","CELULAR"] as const)("resposta %s só resolve H se estritamente posterior",async origem=>{
    const pausa=new Date(AGORA344.getTime()-1000);
    const m=await prisma.mensagemWhatsApp.create({data:{atendimentoId:c.D.id,conversaId:c.D.conversaId,numeroId:c.numero.id,direcao:"SAIDA",origem,corpo:"fixture",driver:"MOTOR",status:"ENVIADA",criadoEm:pausa}});
    for(const ms of [-1,0,1]){await prisma.mensagemWhatsApp.update({where:{id:m.id},data:{criadoEm:new Date(pausa.getTime()+ms)}});expect((await paridade()).get(c.D.id)).toBe(ms>0?"humano":"handoff");}
  });
  it("Assumido usa o mesmo limite estrito em ms",async()=>{
    const pausa=new Date(AGORA344.getTime()-1000);const e=await prisma.evento.create({data:{tipo:"AtendimentoAssumido",agregadoTipo:"AtendimentoWhatsApp",agregadoId:c.D.id,autorId:c.admin.id,payload:{},criadoEm:pausa}});
    for(const ms of [-1,0,1]){await prisma.evento.update({where:{id:e.id},data:{criadoEm:new Date(pausa.getTime()+ms)}});expect((await paridade()).get(c.D.id)).toBe(ms>0?"humano":"handoff");}
  });
  it("expiração T−1/T/T+1 em três TZ da mesma conexão",async()=>{
    const s=await prisma.acaoAgenteIA.findFirstOrThrow({where:{atendimentoId:c.C.id,status:"SUGERIDA"}});
    await prisma.$transaction(async tx=>{const [antes]=await tx.$queryRaw<{tz:string}[]>`SELECT current_setting('TimeZone') AS tz`;
      try{for(const tz of ["UTC","America/Sao_Paulo","Asia/Tokyo"]){await tx.$queryRaw`SELECT set_config('TimeZone',${tz},true)`;for(const ms of [-1,0,1]){await tx.acaoAgenteIA.update({where:{id:s.id},data:{expiraEm:new Date(AGORA344.getTime()+ms)}});expect((await paridade(tx)).get(c.C.id)).toBe(ms>0?"aprovacao":"ia");}}}
      finally{await tx.$queryRaw`SELECT set_config('TimeZone',${antes.tz},true)`;}
    },{timeout:30000});
  });
  it("grupo é NULL via SELECT sintético; não burla trigger para gravar atendimento de grupo",async()=>{
    const [r]=await prisma.$queryRaw<{estado:string|null}[]>(Prisma.sql`SELECT ${estadoAriaEmSql(true,AGORA344)} AS estado
      FROM (SELECT 'grupo344'::text AS id,NULL::timestamp AS "encerradoEm",NULL::timestamp AS "iaPausadaEm",NULL::"MotivoPausaAtendimentoIA" AS "iaPausaMotivo",'COMERCIAL'::"FinalidadeAtendimentoWhatsApp" AS finalidade,NULL::text AS "responsavelId") a
      CROSS JOIN (SELECT 'grupo'::text AS "grupoId",NULL::text AS "contatoId") c
      CROSS JOIN (SELECT NULL::text AS "donoId") n CROSS JOIN (SELECT NULL::timestamp AS "optOutEm") ct`);
    expect(r.estado).toBeNull();
  });
});
