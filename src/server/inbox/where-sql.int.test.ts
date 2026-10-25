import { beforeAll, describe, expect, it } from "vitest";
import { Papel, Prisma, PrismaClient, type FinalidadeAtendimentoWhatsApp } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { escopoAtendimentos, type Db } from "@/server/whatsapp/escopo";
import { whereBuscaConversas } from "@/server/whatsapp/busca-inbox";
import { whereAtendimentoEmSql } from "./where-sql";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
const agora = new Date("2026-10-24T12:00:00.123Z");
type U = Awaited<ReturnType<typeof criarUsuario>>;
let usuarios: Record<string,U>, ids: Record<string,string>, conviteId: string, linhaId: string, coberturaId: string, vinculoId: string;
let seq = 0;
async function iguais(where: Prisma.AtendimentoWhatsAppWhereInput, db: Db = prisma) {
  const esperados = (await db.atendimentoWhatsApp.findMany({ where, select: { id: true }, orderBy: { id: "asc" } })).map(a => a.id);
  const reais = await db.$queryRaw<{id:string}[]>(Prisma.sql`SELECT a."id" FROM "AtendimentoWhatsApp" a WHERE ${whereAtendimentoEmSql(where)} ORDER BY a."id"`);
  expect(reais.map(a => a.id)).toEqual(esperados); return esperados;
}
async function acl(nome: string, enviar = false, db: Db = prisma) { return iguais(await escopoAtendimentos(usuarios[nome], { db, agora, enviar }), db); }
beforeAll(async () => {
  await truncarBanco(); const cat = await seedCatalogoMinimo(); usuarios = {};
  for (const [nome,papeis] of Object.entries({ admin:[Papel.ADMINISTRADOR], gerente:[Papel.GERENTE_COMERCIAL], vendedor:[Papel.VENDEDOR], outro:[Papel.VENDEDOR], substituto:[Papel.VENDEDOR], financeiro:[Papel.FINANCEIRO], secretaria:[Papel.SECRETARIA_ACADEMICA], professor:[Papel.PROFESSOR], gestorPed:[Papel.GERENTE_PEDAGOGICO], combinado:[Papel.VENDEDOR,Papel.PROFESSOR,Papel.FINANCEIRO], sem:[Papel.ALUNO] })) usuarios[nome]=await criarUsuario(papeis,nome);
  await prisma.usuario.update({where:{id:usuarios.vendedor.id},data:{gerenteComercialId:usuarios.gerente.id}});
  const cobertura=await prisma.coberturaCarteira.create({data:{titularId:usuarios.vendedor.id,substitutoId:usuarios.substituto.id,concedenteId:usuarios.gerente.id,inicio:new Date(Date.now()-60000),fim:new Date(Date.now()+60000),motivo:"fixture344"}}); coberturaId=cobertura.id;
  const nivel=await prisma.nivel.create({data:{idiomaId:cat.idioma.id,codigo:"A1",ordem:1}});
  const turma=await prisma.turma.create({data:{nivelId:nivel.id,modalidadeId:cat.modalidade.id,professorId:usuarios.professor.id,nome:"344"}});
  const vinculo=await prisma.vinculoDocente.create({data:{turmaId:turma.id,professorId:usuarios.professor.id,inicio:new Date(agora.getTime()-1)}}); vinculoId=vinculo.id;
  const aluno=await prisma.aluno.create({data:{primeiroNome:"José",sobrenome:"Silva",paisId:cat.pais.id,telefoneE164:"+50680009999",whatsapp:true}});
  const matricula=await prisma.matricula.create({data:{alunoId:aluno.id,produtoId:cat.produto.id,paisId:cat.pais.id,moeda:"CRC"}});
  await prisma.alocacaoTurma.create({data:{alunoId:aluno.id,matriculaId:matricula.id,turmaId:turma.id}});
  const responsavel=await prisma.responsavel.create({data:{nome:"Responsável %_ barra\\b"}});
  const institucional=await prisma.numeroWhatsApp.create({data:{telefoneE164:"+50670000344",rotulo:"344 institucional",driver:"MOTOR",finalidade:"AGENDA",setores:{create:[{finalidade:"COMERCIAL"},{finalidade:"FINANCEIRO"},{finalidade:"SECRETARIA"},{finalidade:"PEDAGOGICO"}]}}});
  const linha=await prisma.numeroWhatsApp.create({data:{telefoneE164:"+50670000345",rotulo:"344 linha",driver:"MOTOR",finalidade:"VENDAS",donoId:usuarios.vendedor.id}});linhaId=linha.id;
  const legado=await prisma.numeroWhatsApp.create({data:{telefoneE164:"+50670000346",rotulo:"344 legado",driver:"MOTOR",finalidade:"COBRANCA",ativo:false}});
  const op=await prisma.oportunidade.create({data:{nome:"Ana %_ barra\\b",vendedorDonoId:usuarios.vendedor.id}});
  const fora=await prisma.oportunidade.create({data:{nome:"Fora",vendedorDonoId:usuarios.outro.id}});
  const experimental=await prisma.oportunidade.create({data:{nome:"Experimental",professorExperimentalId:usuarios.professor.id,etapa:"EXPERIMENTAL_AGENDADA"}}); ids={};
  async function a(nome:string,setor:FinalidadeAtendimentoWhatsApp,extras:Record<string,unknown>={},numeroId=institucional.id) {
    seq++; const ct=await prisma.contatoWhatsApp.create({data:{telefoneE164:nome==="turma"?aluno.telefoneE164!:"+5068"+String(seq).padStart(7,"0"),alunoId:nome==="turma"?aluno.id:null,nomeExibicao:nome==="carteira"?"Ana %_ barra\\b":nome,nomePerfil:"Perfil "+nome,responsavelId:nome==="turma"?null:responsavel.id}});
    const c=await prisma.conversaWhatsApp.create({data:{numeroId,contatoId:ct.id}});
    const row=await prisma.atendimentoWhatsApp.create({data:{conversaId:c.id,contextoChave:"344-"+seq,finalidade:setor,...extras} as Prisma.AtendimentoWhatsAppUncheckedCreateInput});ids[nome]=row.id;return row;
  }
  await a("carteira","COMERCIAL",{leadId:op.id}); await a("fora","COMERCIAL",{leadId:fora.id});
  await a("semLeadProprio","COMERCIAL",{responsavelId:usuarios.vendedor.id}); await a("linha","COMERCIAL",{leadId:fora.id},linha.id);
  await a("experimental","PEDAGOGICO",{leadId:experimental.id}); await a("turma","PEDAGOGICO",{alunoId:aluno.id,matriculaId:matricula.id,turmaId:turma.id});
  const f=await a("financeiro","FINANCEIRO",{responsavelId:usuarios.financeiro.id,alunoId:aluno.id,matriculaId:matricula.id});
  await a("finInativo","FINANCEIRO",{alunoId:aluno.id,matriculaId:matricula.id},legado.id); await a("secretaria","SECRETARIA"); await a("pedFila","PEDAGOGICO");
  await a("encerrado","SECRETARIA",{status:"ENCERRADO",encerradoEm:agora});
  const c=await a("convite","SECRETARIA",{responsavelId:usuarios.secretaria.id});
  const convite=await prisma.participanteAtendimentoWhatsApp.create({data:{atendimentoId:c.id,usuarioId:usuarios.outro.id,concedenteId:usuarios.admin.id,inicio:new Date(agora.getTime()-1),fim:new Date(agora.getTime()+1),podeEnviar:false,motivo:"fixture344"}});conviteId=convite.id;
  await prisma.atendimentoWhatsApp.update({where:{id:f.id},data:{prazoRespostaEm:agora,naoLidas:2}});
  await prisma.preferenciaConversaUsuario.create({data:{usuarioId:usuarios.financeiro.id,conversaId:f.conversaId,fixadaEm:agora,marcadaNaoLida:true,lidaAte:agora}});
},30000);
describe("paridade SQL/Prisma344 real", () => {
  it.each(["admin","gerente","vendedor","outro","substituto","financeiro","secretaria","professor","gestorPed","combinado","sem"])("ACL canônica de %s, leitura e envio",async nome=>{await acl(nome);await acl(nome,true);});
  it("resultados positivos/negativos reais não são só conjuntos vazios",async()=>{
    expect(await acl("admin")).toHaveLength(12);expect(await acl("vendedor")).toEqual(expect.arrayContaining([ids.carteira,ids.semLeadProprio,ids.linha]));expect(await acl("vendedor")).not.toContain(ids.fora);
    expect(await acl("professor")).toEqual([ids.experimental,ids.turma].sort());expect(await acl("professor")).not.toContain(ids.pedFila);expect(await acl("financeiro",true)).not.toContain(ids.finInativo);
  });
  it.each([
    {},{AND:[]},{OR:[]},{OR:[{}]},{NOT:{}},{NOT:[]},{AND:[{}, {OR:[]}]},{AND:[{OR:[]}]},{AND:[{OR:[]},{id:"ausente"}]},{OR:[{AND:[]}]},{NOT:{OR:[]}},{OR:[{OR:[]}]},{NOT:[{OR:[]}]},{AND:{OR:[]}},{OR:[{id:{in:[]}},{}]},{NOT:{AND:[]}},
    {AND:[{OR:[]},{naoLidas:{gt:0}}]},{AND:[{OR:[{}]},{naoLidas:{gt:0}}]},{OR:[],naoLidas:{gt:0}},{OR:[{}, {naoLidas:{gt:0}}]},
    {OR:[{AND:[{OR:[]}]}]},{NOT:[{}, {OR:[]}, {naoLidas:{gt:0}}]},{AND:[{NOT:[]},{naoLidas:{gt:0}}]},
    {responsavelId:null},{responsavelId:{not:null}},{responsavelId:{not:"ausente"}},{NOT:{responsavelId:"ausente"}},
    {NOT:[{responsavelId:null},{status:"ENCERRADO"}]},{id:{in:[]}},{status:{in:["ENCERRADO"]}},
    {conversa:{contato:{is:null}}},{lead:{is:null}},{lead:{is:{}}},{participantes:{some:{}}},{participantes:{none:{}}},
    {conversa:{preferenciasUsuarios:{some:{marcadaNaoLida:true}}}},{conversa:{preferenciasUsuarios:{none:{lidaAte:{not:null}}}}},
    {prazoRespostaEm:{lt:new Date(agora.getTime()+1)}},{prazoRespostaEm:{lte:agora}},{prazoRespostaEm:{gt:agora}},{naoLidas:{gt:0}},
  ] as Prisma.AtendimentoWhatsAppWhereInput[])("semântica de operador/NULL: %j",async w=>{await iguais(w);});
  it.each(["Ana","José Silva","Perfil carteira","%_",String.raw`barra\b`,"123","' OR 1=1 --"])("busca canônica real: %s",async busca=>{await iguais(whereBuscaConversas(busca));});
  it("NOT de relação opcional e busca de barra com escape preservam resultados positivos",async()=>{
    for(const w of [{NOT:{lead:{is:null}}},{NOT:{lead:{is:{id:"ausente"}}}},{NOT:{conversa:{contato:{responsavel:{nome:{contains:"Responsável",mode:"insensitive" as const}}}}}}]) await iguais(w);
    const w=whereBuscaConversas("barra"+String.fromCharCode(92).repeat(2)+"b");expect((await iguais(w)).length).toBeGreaterThan(0);
  });
  it("contexto real com membro301 não é truncado e usa a mesma tx",async()=>{
    await expect(prisma.$transaction(async tx=>{
      const membros=Array.from({length:301},(_,n)=>({id:"344-equipe-"+n,nome:"Membro"+n,email:"344-equipe-"+n+"@example.test",senhaHash:"fake",papeis:[Papel.VENDEDOR],gerenteComercialId:usuarios.gerente.id}));
      await tx.usuario.createMany({data:membros});
      const atendimento=await tx.atendimentoWhatsApp.findUniqueOrThrow({where:{id:ids.carteira}});
      await tx.oportunidade.update({where:{id:atendimento.leadId!},data:{vendedorDonoId:membros[300].id}});
      const where={lead:{is:await escopoComercialAtual(usuarios.gerente,tx)}};
      expect(await iguais(where,tx)).toContain(ids.carteira);
      throw Error("ROLLBACK_EQUIPE344");
    },{timeout:15000})).rejects.toThrow("ROLLBACK_EQUIPE344");
    expect(await prisma.usuario.findUnique({where:{id:"344-equipe-300"}})).toBeNull();
  });
  it("convite: fim estrito, revogação e podeEnviar são independentes",async()=>{
    expect(await acl("outro")).toContain(ids.convite);expect(await acl("outro",true)).not.toContain(ids.convite);
    try{await prisma.participanteAtendimentoWhatsApp.update({where:{id:conviteId},data:{fim:agora}});expect(await acl("outro")).not.toContain(ids.convite);await prisma.participanteAtendimentoWhatsApp.update({where:{id:conviteId},data:{fim:new Date(agora.getTime()+1),revogadoEm:agora}});expect(await acl("outro")).not.toContain(ids.convite);}
    finally{await prisma.participanteAtendimentoWhatsApp.update({where:{id:conviteId},data:{fim:new Date(agora.getTime()+1),revogadoEm:null}});}
  });
  it("posse atual e desativação não mantêm o dono antigo",async()=>{
    try{await prisma.numeroWhatsApp.update({where:{id:linhaId},data:{donoId:usuarios.substituto.id}});expect(await acl("vendedor")).not.toContain(ids.linha);expect(await acl("substituto")).toContain(ids.linha);await prisma.numeroWhatsApp.update({where:{id:linhaId},data:{ativo:false}});expect(await acl("substituto")).not.toContain(ids.linha);expect(await acl("outro")).toContain(ids.linha);}
    finally{await prisma.numeroWhatsApp.update({where:{id:linhaId},data:{ativo:true,donoId:usuarios.vendedor.id}});}
  });
  it("revogação da cobertura e vínculo docente encerrado revogam só suas vias",async()=>{
    await prisma.coberturaCarteira.update({where:{id:coberturaId},data:{inicio:new Date(Date.now()-60000),fim:new Date(Date.now()+60000)}});
    try{expect(await acl("substituto")).toContain(ids.carteira);await prisma.coberturaCarteira.update({where:{id:coberturaId},data:{revogadaEm:agora}});expect(await acl("substituto")).not.toContain(ids.carteira);await prisma.vinculoDocente.update({where:{id:vinculoId},data:{fim:agora}});expect(await acl("professor")).not.toContain(ids.turma);expect(await acl("professor")).toContain(ids.experimental);}
    finally{await prisma.coberturaCarteira.update({where:{id:coberturaId},data:{revogadaEm:null}});await prisma.vinculoDocente.update({where:{id:vinculoId},data:{fim:null}});}
  });
  it("pool1 usa ACL/linha não commitadas no mesmo Db e preserva rollback",async()=>{
    const url=new URL(process.env.DATABASE_URL!);url.searchParams.set("connection_limit","1");const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
    try{await expect(db.$transaction(async tx=>{await tx.numeroWhatsApp.update({where:{id:linhaId},data:{donoId:usuarios.substituto.id}});const where=await escopoAtendimentos(usuarios.substituto,{db:tx,agora});expect(await iguais(where,tx)).toContain(ids.linha);throw Error("ROLLBACK344");},{timeout:10000})).rejects.toThrow("ROLLBACK344");expect((await db.numeroWhatsApp.findUniqueOrThrow({where:{id:linhaId}})).donoId).toBe(usuarios.vendedor.id);}
    finally{await db.$disconnect();}
  });
  it("Date mantém resultado nas três TZ da mesma conexão, restauradas",async()=>{
    await prisma.$transaction(async tx=>{const [antes]=await tx.$queryRaw<{tz:string}[]>`SELECT current_setting('TimeZone') AS tz`;
      try{for(const tz of ["UTC","America/Sao_Paulo","Asia/Tokyo"]){await tx.$queryRaw`SELECT set_config('TimeZone',${tz},true)`;for(const ms of [-1,0,1])await iguais({prazoRespostaEm:{gt:new Date(agora.getTime()+ms)}},tx);}}
      finally{await tx.$queryRaw`SELECT set_config('TimeZone',${antes.tz},true)`;}
    },{timeout:15000});
  });
});
