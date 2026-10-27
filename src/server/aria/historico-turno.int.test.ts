import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, Prisma } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared/sessao", async original => {
  const real = await original<typeof import("@/server/_shared/sessao")>();
  return { ...real, exigirSessao: async () => {
    const id = (await authMock())?.user?.id;
    const u = typeof id === "string" ? await real.carregarUsuarioFresco(id) : null;
    if (!u) throw new real.ErroAutenticacao();
    if (real.apenasPortal(u)) throw new real.ErroPermissao("Acesso restrito ao portal do aluno.");
    return u;
  } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";

import { aprovarTurnoAria, rejeitarTurnoAria } from "./decisao-inbox";

type U = Awaited<ReturnType<typeof criarUsuario>>;
const logado = (u: U) => authMock.mockResolvedValue({ user: { id: u.id } });

let seq = 0;
async function cenario() {
  const cat = await seedCatalogoMinimo();
  const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const gerenteOutra = await criarUsuario([Papel.GERENTE_COMERCIAL], "Outra equipe");
  const dono = await criarUsuario([Papel.VENDEDOR]);
  await prisma.usuario.update({ where: { id: dono.id }, data: { gerenteComercialId: gerente.id } });
  const { numero } = await seedCanal({ estado: "ATIVA" });
  const pessoa = await prisma.pessoa.create({ data: { nome: "Maria" } });
  const op = await prisma.oportunidade.create({
    data: { nome: "Maria", paisId: cat.pais.id, telefoneE164: "+50688888888", vendedorDonoId: dono.id, pessoaId: pessoa.id },
  });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688888888", leadId: op.id } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: op.id }));
  const conv = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: at.id }, select: { conversaId: true } });
  const ancora = await prisma.mensagemWhatsApp.create({
    data: { atendimentoId: at.id, conversaId: conv.conversaId, numeroId: numero.id, direcao: "ENTRADA", corpo: "oi", driver: "MOTOR", status: "ENTREGUE", providerMessageId: `hist-${++seq}` },
  });
  const turno = await prisma.turnoAgenteIA.create({ data: { ancoraMensagemId: ancora.id, atendimentoId: at.id, tipo: "ATENDIMENTO", resultado: "EM_ANDAMENTO" } });
  const tag = await prisma.tag.create({ data: { nome: "Interessado", cor: "INFO" } });
  const campo = await prisma.campoPersonalizado.create({ data: { nome: "objetivo", tipo: "TEXTO", alvo: "PESSOA" } });
  return { op, at, turno, tag, campo, pessoa, gerente, gerenteOutra, dono };
}

describe("pacote da Aria por turno (D2)", () => {
 let c: Awaited<ReturnType<typeof cenario>>;
 beforeEach(async()=>{
  await truncarBanco(); authMock.mockReset(); c=await cenario();
  await prisma.atendimentoWhatsApp.update({where:{id:c.at.id},data:{responsavelId:c.dono.id}});
  logado(c.dono);
 });
 const sugerir=(acao:"TAG"|"MOVER_ETAPA"|"CRIAR_TAREFA",o:{payload?:Prisma.InputJsonObject;oportunidadeId?:string}={})=>prisma.acaoAgenteIA.create({data:{turnoId:c.turno.id,atendimentoId:c.at.id,oportunidadeId:o.oportunidadeId??c.op.id,acao,modoConfigurado:"SUGERE",status:"SUGERIDA",confianca:90,reversivel:true,
  payload:o.payload??(acao==="TAG"?{pessoaId:c.pessoa.id,tagId:c.tag.id,nome:c.tag.nome}:acao==="MOVER_ETAPA"?{de:"NOVO",para:"EM_ATENDIMENTO"}:{titulo:"Ligar amanhã",venceEmISO:new Date(Date.now()+86400000).toISOString()})}});
 async function pacote(){return [await sugerir("CRIAR_TAREFA"),await sugerir("TAG"),await sugerir("MOVER_ETAPA")];}
 const entrada=(ids:string[],chave="chave-pacote-0001")=>({turnoId:c.turno.id,atendimentoId:c.at.id,acaoIds:ids,chaveIdempotencia:chave});

 it("aprova_todas_do_turno_na_ordem",async()=>{
  const p=await pacote();
  expect(await aprovarTurnoAria(entrada(p.map(x=>x.id)))).toEqual({ok:true,dado:{aprovadas:3}});
  expect(await prisma.acaoAgenteIA.count({where:{turnoId:c.turno.id,status:"APROVADA",decididaPorId:c.dono.id}})).toBe(3);
  expect((await prisma.oportunidade.findUniqueOrThrow({where:{id:c.op.id}})).etapa).toBe("EM_ATENDIMENTO");
  expect(await prisma.pessoaTag.count({where:{pessoaId:c.pessoa.id,tagId:c.tag.id}})).toBe(1);
  expect(await prisma.tarefa.count({where:{atendimentoId:c.at.id,titulo:"Ligar amanhã"}})).toBe(1);
  const eventos=await prisma.evento.findMany({where:{tipo:"AcaoAriaAprovada",agregadoId:{in:p.map(x=>x.id)}},orderBy:[{criadoEm:"asc"},{id:"asc"}]});
  expect(eventos).toHaveLength(3);
  expect(eventos.map(e=>(e.payload as {acao:string}).acao)).toEqual(["MOVER_ETAPA","TAG","CRIAR_TAREFA"]);
  expect(eventos.filter(e=>(e.payload as {chaveIdempotencia?:string}).chaveIdempotencia==="chave-pacote-0001")).toHaveLength(1);
  expect((eventos[0].payload as {chaveIdempotencia?:string}).chaveIdempotencia).toBe("chave-pacote-0001");
 });
 it("falha_em_uma_desfaz_todas",async()=>{
  const p=await pacote();
  await prisma.pessoaTag.create({data:{pessoaId:c.pessoa.id,tagId:c.tag.id}});
  const r=await aprovarTurnoAria(entrada(p.map(x=>x.id)));
  expect(r).toEqual({ok:false,erro:"Não foi possível aplicar a tag: A pessoa já tem essa tag."});
  expect(await prisma.acaoAgenteIA.count({where:{turnoId:c.turno.id,status:"SUGERIDA"}})).toBe(3);
  expect((await prisma.oportunidade.findUniqueOrThrow({where:{id:c.op.id}})).etapa).toBe("NOVO");
  expect(await prisma.tarefa.count({where:{atendimentoId:c.at.id}})).toBe(0);
  expect(await prisma.evento.count({where:{tipo:"AcaoAriaAprovada"}})).toBe(0);
 });
 it("turno_com_acao_fora_do_escopo_falha_inteiro",async()=>{
  const cat=await prisma.pais.findFirstOrThrow();
  const outra=await prisma.oportunidade.create({data:{nome:"Outra",paisId:cat.id,telefoneE164:"+50677777777",vendedorDonoId:c.dono.id}});
  const p=[await sugerir("TAG"),await sugerir("MOVER_ETAPA",{oportunidadeId:outra.id})];
  expect((await aprovarTurnoAria(entrada(p.map(x=>x.id)))).ok).toBe(false);
  expect(await prisma.acaoAgenteIA.count({where:{turnoId:c.turno.id,status:"SUGERIDA"}})).toBe(2);
  expect(await prisma.pessoaTag.count()).toBe(0);
 });
 it("repetido_com_a_mesma_chave_e_ok",async()=>{
  const p=await pacote();const ids=p.map(x=>x.id);
  const [a,b]=await Promise.all([aprovarTurnoAria(entrada(ids)),aprovarTurnoAria(entrada(ids))]);
  expect(a).toEqual({ok:true,dado:{aprovadas:3}});expect(b).toEqual({ok:true,dado:{aprovadas:3}});
  expect(await aprovarTurnoAria(entrada(ids))).toEqual({ok:true,dado:{aprovadas:3}});
  expect(await prisma.evento.count({where:{tipo:"AcaoAriaAprovada"}})).toBe(3);
  expect(await prisma.tarefa.count({where:{atendimentoId:c.at.id}})).toBe(1);
  expect((await aprovarTurnoAria(entrada(ids,"outra-chave-0002"))).ok).toBe(false);
 });
 it("pacote desatualizado pede para reabrir sem decidir nada",async()=>{
  const p=await pacote();await sugerir("TAG",{payload:{pessoaId:c.pessoa.id,tagId:c.tag.id,nome:"extra"}});
  expect(await aprovarTurnoAria(entrada(p.map(x=>x.id)))).toEqual({ok:false,erro:"As sugestões deste turno mudaram. Reabra o painel antes de decidir."});
  expect(await prisma.acaoAgenteIA.count({where:{status:"SUGERIDA"}})).toBe(4);
 });
 it("tag com pessoa divergente fora do fio recusa o bloco das visíveis com mensagem de escopo",async()=>{
  const visiveis=[await sugerir("CRIAR_TAREFA"),await sugerir("MOVER_ETAPA")];
  const outra=await prisma.pessoa.create({data:{nome:"Outra pessoa"}});
  await sugerir("TAG",{payload:{pessoaId:outra.id,tagId:c.tag.id,nome:c.tag.nome}});
  expect(await aprovarTurnoAria(entrada(visiveis.map(x=>x.id)))).toEqual({ok:false,erro:"Há ações deste turno fora do seu escopo. Decida as demais individualmente."});
  expect(await prisma.acaoAgenteIA.count({where:{turnoId:c.turno.id,status:"SUGERIDA"}})).toBe(3);
  expect(await prisma.tarefa.count({where:{atendimentoId:c.at.id}})).toBe(0);
 });
 it("sugestão vencida e ainda não varrida não trava o bloco das vigentes",async()=>{
  const p=[await sugerir("CRIAR_TAREFA"),await sugerir("MOVER_ETAPA")];
  const vencida=await sugerir("TAG");
  await prisma.acaoAgenteIA.update({where:{id:vencida.id},data:{expiraEm:new Date(Date.now()-60_000)}});
  expect(await aprovarTurnoAria(entrada(p.map(x=>x.id)))).toEqual({ok:true,dado:{aprovadas:2}});
  expect((await prisma.acaoAgenteIA.findUniqueOrThrow({where:{id:vencida.id}})).status).toBe("SUGERIDA");
 });
 it("rejeitar o turno inteiro grava o motivo em todas e repete com a mesma chave",async()=>{
  const p=await pacote();const ids=p.map(x=>x.id);
  expect(await rejeitarTurnoAria({...entrada(ids),motivo:"Agora não"})).toEqual({ok:true,dado:{rejeitadas:3}});
  expect(await rejeitarTurnoAria({...entrada(ids),motivo:"Agora não"})).toEqual({ok:true,dado:{rejeitadas:3}});
  expect(await prisma.acaoAgenteIA.count({where:{turnoId:c.turno.id,status:"REJEITADA"}})).toBe(3);
  expect(await prisma.evento.count({where:{tipo:"AcaoAriaRejeitada",payload:{path:["motivo"],equals:"Agora não"}}})).toBe(3);
  expect((await prisma.oportunidade.findUniqueOrThrow({where:{id:c.op.id}})).etapa).toBe("NOVO");
 });
});
