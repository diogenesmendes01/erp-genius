import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { Papel, PrismaClient } from "@prisma/client";
import { Client } from "pg";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { CANAL_INBOX } from "./barramento";
import * as aviso from "./aviso";
import * as pessoas from "@/server/crm/contatos";
import { carregarDetalhesPainel, pessoaDoAtendimento } from "./painel-detalhes";
import { editarContatoNoInbox } from "./acoes-painel";
let seq = 0;
beforeEach(async () => { vi.restoreAllMocks(); await truncarBanco(); });
afterAll(() => prisma.$disconnect());
async function cenario() {
  const dono = await criarUsuario([Papel.VENDEDOR]);
  const pessoa = await prisma.pessoa.create({ data: { nome: "Pessoa fictícia326", cidade: "Cidade inicial", email: "antes326@example.test" } });
  const op = await prisma.oportunidade.create({ data: { nome: "Curso fictício326", vendedorDonoId: dono.id, pessoaId: pessoa.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+5500000326" + ++seq, pessoaId: pessoa.id } });
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5500001326" + seq, rotulo: "Linha fictícia326", driver: "MOTOR", finalidade: "VENDAS", donoId: dono.id } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
  const a = await prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: "COMERCIAL::326:" + seq, finalidade: "COMERCIAL", leadId: op.id } });
  const texto = await prisma.campoPersonalizado.create({ data: { nome: "Objetivo326", alvo: "PESSOA", tipo: "TEXTO" } });
  const numeroCampo = await prisma.campoPersonalizado.create({ data: { nome: "Horas326", alvo: "PESSOA", tipo: "NUMERO" } });
  authMock.mockResolvedValue({ user: { id: dono.id } }); return { dono, pessoa, op, contato, numero, conversa, a, texto, numeroCampo };
}
const entrada = (c: Awaited<ReturnType<typeof cenario>>) => ({ pessoaIdEsperada: c.pessoa.id, pessoa: { cidade: "Campinas fictícia", email: "novo326@example.test" }, campos: [{ campoId: c.texto.id, valor: "Avançado" }, { campoId: c.numeroCampo.id, valor: 0 }] });
async function escutar() {
  const client = new Client({ connectionString: process.env.DATABASE_URL }); const quadros: Record<string, unknown>[] = [];
  client.on("notification", n => { if (n.channel === CANAL_INBOX && n.payload) quadros.push(JSON.parse(n.payload)); });
  await client.connect(); await client.query("LISTEN " + CANAL_INBOX); return { quadros, sair: () => client.end() };
}
async function sentinela(c: Awaited<ReturnType<typeof cenario>>, quadros: Record<string, unknown>[]) {
  const a = await prisma.atendimentoWhatsApp.create({ data: { conversaId: c.conversa.id, contextoChave: "COMERCIAL::sentinela326:" + ++seq, finalidade: "COMERCIAL", leadId: c.op.id } });
  await aviso.avisarAtendimento(prisma, a.id); await vi.waitFor(() => expect(quadros.some(q => q.atendimentoId === a.id)).toBe(true));
}
it("Pessoa e dois campos reais são atômicos; repetição não duplica Evento nem aviso e email é redigido", async () => {
  const c = await cenario(), e = await escutar(); try {
    expect(await editarContatoNoInbox(c.a.id, entrada(c))).toEqual({ ok: true }); expect(await editarContatoNoInbox(c.a.id, entrada(c))).toEqual({ ok: true });
    await sentinela(c, e.quadros);
    expect(await prisma.pessoa.findUnique({ where: { id: c.pessoa.id } })).toMatchObject({ cidade: "Campinas fictícia", email: "novo326@example.test" });
    expect((await prisma.valorCampoPersonalizado.findMany({ where: { pessoaId: c.pessoa.id } })).map(v => v.valor)).toEqual(expect.arrayContaining(["Avançado", 0]));
    const eventos = await prisma.evento.findMany({ where: { agregadoId: c.pessoa.id } }); expect(eventos).toHaveLength(3); expect(eventos.every(ev => ev.autorId === c.dono.id)).toBe(true);
    expect(JSON.stringify(eventos.find(ev => ev.tipo === "PessoaEditada")?.payload)).not.toContain("@example.test");
    expect(e.quadros.filter(q => q.atendimentoId === c.a.id)).toEqual([{ tipo: "atendimento.atualizado", atendimentoId: c.a.id, conversaId: c.conversa.id, mensagemId: null }]);
  } finally { await e.sair(); }
});
it("segundo campo inválido não grava Pessoa nem o primeiro campo/Eventos/aviso", async () => {
  const c = await cenario(), avisar = vi.spyOn(aviso, "avisarAtendimento"); const dados = entrada(c); dados.campos[1].valor = "abc";
  expect((await editarContatoNoInbox(c.a.id, dados)).ok).toBe(false);
  expect((await prisma.pessoa.findUniqueOrThrow({ where: { id: c.pessoa.id } })).cidade).toBe("Cidade inicial");
  expect(await prisma.valorCampoPersonalizado.count()).toBe(0); expect(await prisma.evento.count()).toBe(0); expect(avisar).not.toHaveBeenCalled();
});
it("email inválido é validado antes de campos e nenhum input alcança outra pessoa/empresa/telefone", async () => {
  const c = await cenario(); for (const pessoa of [{ email: "invalido" }, { empresaId: "alheia" }, { telefone: "+5500000001" }]) expect((await editarContatoNoInbox(c.a.id, { pessoaIdEsperada: c.pessoa.id, pessoa, campos: [{ campoId: c.texto.id, valor: "X" }] } as never)).ok).toBe(false);
  expect((await editarContatoNoInbox(c.a.id, { pessoaIdEsperada: c.pessoa.id, pessoaId: "outra", pessoa: { cidade: "X" } } as never)).ok).toBe(false);
  expect(await prisma.valorCampoPersonalizado.count()).toBe(0); expect(await prisma.evento.count()).toBe(0);
});
it.each(["arquivado", "empresa", "inexistente", "duplicado"])("campo %s não autoriza escrita parcial", async caso => {
  const c = await cenario(); if (caso === "arquivado") await prisma.campoPersonalizado.update({ where: { id: c.texto.id }, data: { arquivadoEm: new Date() } });
  if (caso === "empresa") await prisma.campoPersonalizado.update({ where: { id: c.texto.id }, data: { alvo: "EMPRESA" } });
  const campos = caso === "duplicado" ? [{ campoId: c.texto.id, valor: "A" }, { campoId: c.texto.id, valor: "B" }] : [{ campoId: caso === "inexistente" ? "nao-existe326" : c.texto.id, valor: "A" }];
  expect((await editarContatoNoInbox(c.a.id, { pessoaIdEsperada: c.pessoa.id, pessoa: { cidade: "X" }, campos })).ok).toBe(false); expect(await prisma.valorCampoPersonalizado.count()).toBe(0); expect(await prisma.evento.count()).toBe(0);
});
it.each(["sem pessoa", "legal", "linha alheia", "sem lead", "outro setor"])("contexto %s não pode editar nem usa vínculoContato como atalho", async caso => {
  const c = await cenario(); if (caso === "sem pessoa") await prisma.oportunidade.update({ where: { id: c.op.id }, data: { pessoaId: null } });
  if (caso === "legal") await prisma.responsavel.create({ data: { pessoaId: c.pessoa.id, nome: "Legal fictício326" } });
  if (caso === "linha alheia") await prisma.oportunidade.update({ where: { id: c.op.id }, data: { vendedorDonoId: (await criarUsuario([Papel.VENDEDOR])).id } });
  if (caso === "sem lead") await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { leadId: null } });
  if (caso === "outro setor") await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { finalidade: "SECRETARIA", contextoChave: "SECRETARIA::326" } });
  expect((await editarContatoNoInbox(c.a.id, entrada(c))).ok).toBe(false); expect(await prisma.valorCampoPersonalizado.count()).toBe(0); expect(await prisma.evento.count()).toBe(0);
});
it("D13 permite ler mas convidado sem contatos.editar e convite revogado não editam", async () => {
  const c = await cenario(), leitor = await criarUsuario([Papel.FINANCEIRO]); const convite = await prisma.participanteAtendimentoWhatsApp.create({ data: { atendimentoId: c.a.id, usuarioId: leitor.id, concedenteId: c.dono.id, inicio: new Date(Date.now()-60000), fim: new Date(Date.now()+3600000), motivo: "Leitura326" } });
  const u = { id: leitor.id, nome: leitor.nome, papeis: leitor.papeis }; expect((await carregarDetalhesPainel(u, c.a.id))?.pessoa?.id).toBe(c.pessoa.id); authMock.mockResolvedValue({ user: { id: leitor.id } });
  expect((await editarContatoNoInbox(c.a.id, entrada(c))).ok).toBe(false); await prisma.participanteAtendimentoWhatsApp.update({ where: { id: convite.id }, data: { revogadoEm: new Date() } });
  expect((await editarContatoNoInbox(c.a.id, entrada(c))).ok).toBe(false); expect(await prisma.evento.count()).toBe(0);
});
it("rollback depois do aviso desfaz Pessoa/campos/Eventos e NÃO publica NOTIFY", async () => {
  const c = await cenario(), e = await escutar(), original = aviso.avisarAtendimento;
  const spy = vi.spyOn(aviso, "avisarAtendimento").mockImplementation(async (...args) => { await original(...args); throw Error("rollback326"); }); const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try { expect((await editarContatoNoInbox(c.a.id, entrada(c))).ok).toBe(false); spy.mockRestore(); await sentinela(c,e.quadros); expect(e.quadros.filter(q=>q.atendimentoId===c.a.id)).toEqual([]); expect(await prisma.evento.count()).toBe(0); expect(await prisma.valorCampoPersonalizado.count()).toBe(0); expect((await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).cidade).toBe("Cidade inicial"); } finally { spy.mockRestore();log.mockRestore();await e.sair(); }
});
it.each(["troca pessoa", "revogação", "papel revogado", "inativado"])("revalida %s depois de esperar lock real de outra conexão", async caso => {
  const c=await cenario(), holder=new PrismaClient();let ator=c.dono,conviteId:string|undefined;
  if(caso==="revogação"){ator=await criarUsuario([Papel.VENDEDOR]); await prisma.oportunidade.create({data:{nome:"Carteira própria326",pessoaId:c.pessoa.id,vendedorDonoId:ator.id}});const convite=await prisma.participanteAtendimentoWhatsApp.create({data:{atendimentoId:c.a.id,usuarioId:ator.id,concedenteId:c.dono.id,inicio:new Date(Date.now()-60000),fim:new Date(Date.now()+3600000),motivo:"Espera326"}});conviteId=convite.id;}
  if(caso==="troca pessoa")await prisma.oportunidade.create({data:{nome:"Carteira antiga preservada326",pessoaId:c.pessoa.id,vendedorDonoId:ator.id}});
  expect(await pessoaDoAtendimento({id:ator.id,nome:ator.nome,papeis:ator.papeis},c.a.id)).toEqual({pessoaId:c.pessoa.id,leadId:c.op.id});authMock.mockResolvedValue({user:{id:ator.id}});
  let pronto!:()=>void,entrou!:()=>void,liberar!:()=>void;const pronta=new Promise<void>(r=>{pronto=r;}),entradaCore=new Promise<void>(r=>{entrou=r;}),livre=new Promise<void>(r=>{liberar=r;});
  const real=pessoas.editarPessoaNaTransacao;const spy=vi.spyOn(pessoas,"editarPessoaNaTransacao").mockImplementation((...args)=>{entrou();return real(...args);});
  let trava: Promise<unknown> | undefined; try{trava=holder.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Pessoa" WHERE id=${c.pessoa.id} FOR UPDATE`;pronto();await livre;if(caso==="troca pessoa"){const outra=await tx.pessoa.create({data:{nome:"Nova pessoa326"}});await tx.oportunidade.update({where:{id:c.op.id},data:{pessoaId:outra.id}});}else if(caso==="revogação")await tx.participanteAtendimentoWhatsApp.update({where:{id:conviteId!},data:{revogadoEm:new Date()}});else await tx.usuario.update({where:{id:ator.id},data:caso==="inativado"?{ativo:false}:{papeis:[Papel.PROFESSOR]}});},{timeout:15000});await pronta;const tentativa=editarContatoNoInbox(c.a.id,entrada(c));await entradaCore;liberar();await trava;expect((await tentativa).ok).toBe(false);expect(await prisma.evento.count()).toBe(0);expect(await prisma.valorCampoPersonalizado.count()).toBe(0);expect((await prisma.pessoa.findUniqueOrThrow({where:{id:c.pessoa.id}})).cidade).toBe("Cidade inicial");}finally{liberar?.();await trava?.catch(() => {});spy.mockRestore();await holder.$disconnect();}
});
it("CAS de identidade aceita a Pessoa efetivamente lida no contexto autorizado", async () => {
  const c = await cenario(); expect(await editarContatoNoInbox(c.a.id, entrada(c))).toEqual({ ok: true });
});
it.each(["ausente", "antiga"])("gaveta com identidade %s não pode editar a nova Pessoa após troca antes do submit", async caso => {
  const c = await cenario(); await prisma.oportunidade.create({ data: { nome: "Carteira antiga mantida326", pessoaId: c.pessoa.id, vendedorDonoId: c.dono.id } });
  const lida = await carregarDetalhesPainel({ id: c.dono.id, nome: c.dono.nome, papeis: c.dono.papeis }, c.a.id); expect(lida?.pessoa?.id).toBe(c.pessoa.id);
  const nova = await prisma.pessoa.create({ data: { nome: "Nova identidade326", cidade: "Cidade nova" } }); await prisma.oportunidade.update({ where: { id: c.op.id }, data: { pessoaId: nova.id } });
  const dados = entrada(c); const semIdentidade = { pessoa: dados.pessoa, campos: dados.campos };
  const resultado = await editarContatoNoInbox(c.a.id, caso === "ausente" ? semIdentidade as never : dados);
  expect(resultado.ok).toBe(false);
  if (caso === "antiga" && !resultado.ok) expect(resultado.erro).toContain("Reabra ou atualize");
  expect((await prisma.pessoa.findUniqueOrThrow({ where: { id: c.pessoa.id } })).cidade).toBe("Cidade inicial"); expect((await prisma.pessoa.findUniqueOrThrow({ where: { id: nova.id } })).cidade).toBe("Cidade nova"); expect(await prisma.evento.count()).toBe(0); expect(await prisma.valorCampoPersonalizado.count()).toBe(0);
});