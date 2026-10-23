import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { Papel, type StatusAtendimentoWhatsApp } from "@prisma/client";
vi.hoisted(() => {
  const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "3"); process.env.DATABASE_URL = url.toString();
  (globalThis as { prisma?: unknown }).prisma = undefined;
});
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { atendimentoParaAbrir, atendimentosParaPessoas } from "./atalhos";

type U = Awaited<ReturnType<typeof criarUsuario>>;
let seq = 0;
beforeEach(truncarBanco);
afterAll(() => prisma.$disconnect());
async function contexto(dono: U) {
  const pessoa = await prisma.pessoa.create({ data: { nome: "Pessoa fictícia 336" } });
  const lead = await prisma.oportunidade.create({ data: { nome: "Oportunidade fictícia 336", vendedorDonoId: dono.id, pessoaId: pessoa.id } });
  const n = ++seq;
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+55000336" + n, rotulo: "Linha fictícia", driver: "BAILEYS", sessao: "DESCONECTADO", finalidade: "COBRANCA" } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+55001336" + n, pessoaId: pessoa.id } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
  return { pessoa, lead, numero, contato, conversa };
}
async function atendimento(c: Awaited<ReturnType<typeof contexto>>, quando: string | null, status: StatusAtendimentoWhatsApp = "EM_ATENDIMENTO", comLead = true, id?: string) {
  return prisma.atendimentoWhatsApp.create({ data: {
    ...(id ? { id } : {}), conversaId: c.conversa.id, contextoChave: "COMERCIAL::336-" + (++seq), finalidade: "COMERCIAL",
    leadId: comLead ? c.lead.id : null, status, ultimaMensagemEm: quando ? new Date(quando) : null,
    encerradoEm: status === "ENCERRADO" ? new Date("2026-10-22T12:00:00Z") : null,
  } });
}
async function convite(id: string, usuario: U, dono: U) {
  return prisma.participanteAtendimentoWhatsApp.create({ data: { atendimentoId: id, usuarioId: usuario.id, concedenteId: dono.id,
    inicio: new Date(Date.now() - 60_000), fim: new Date(Date.now() + 3_600_000), podeEnviar: false, motivo: "Leitura fictícia 336" } });
}
it("ID explícito visível encerrado vence uma conversa aberta mais recente do lead", async () => {
  const u = await criarUsuario([Papel.ADMINISTRADOR]), c = await contexto(u);
  const antigo = await atendimento(c, "2026-10-01T12:00Z", "ENCERRADO");
  await atendimento(c, "2026-10-22T12:00Z");
  expect(await atendimentoParaAbrir(u, { atendimentoId: antigo.id, leadId: c.lead.id, pessoaId: c.pessoa.id })).toEqual({ atendimentoId: antigo.id, aberta: false });
});
it("prefere o aberto mais recente do lead antes da pessoa", async () => {
  const u = await criarUsuario([Papel.ADMINISTRADOR]), c = await contexto(u);
  await atendimento(c, "2026-10-01T12:00Z"); const recente = await atendimento(c, "2026-10-20T12:00Z");
  const pessoaMaisRecente = await atendimento(c, "2026-10-22T12:00Z", "EM_ATENDIMENTO", false);
  expect(await atendimentoParaAbrir(u, { leadId: c.lead.id, pessoaId: c.pessoa.id })).toEqual({ atendimentoId: recente.id, aberta: true });
  expect(await atendimentoParaAbrir(u, { pessoaId: c.pessoa.id })).toEqual({ atendimentoId: pessoaMaisRecente.id, aberta: true });
});
it("cai em pessoa aberta e, sem abertos, no encerrado mais recente", async () => {
  const u = await criarUsuario([Papel.ADMINISTRADOR]), c = await contexto(u);
  await atendimento(c, "2026-10-20T12:00Z", "ENCERRADO"); const aberta = await atendimento(c, "2026-10-01T12:00Z", "EM_ATENDIMENTO", false);
  expect(await atendimentoParaAbrir(u, { leadId: c.lead.id, pessoaId: c.pessoa.id })).toEqual({ atendimentoId: aberta.id, aberta: true });
  await prisma.atendimentoWhatsApp.update({ where: { id: aberta.id }, data: { status: "ENCERRADO", encerradoEm: new Date() } });
  const final = await atendimento(c, "2026-10-22T12:00Z", "ENCERRADO", false);
  expect(await atendimentoParaAbrir(u, { leadId: c.lead.id, pessoaId: c.pessoa.id })).toEqual({ atendimentoId: final.id, aberta: false });
});
it("mais novo invisível não esconde antigo visível nem herda o convite de A para B", async () => {
  const dono = await criarUsuario([Papel.VENDEDOR]), convidado = await criarUsuario([Papel.VENDEDOR]), c = await contexto(dono);
  const a = await atendimento(c, "2026-10-01T12:00Z"), b = await atendimento(c, "2026-10-22T12:00Z");
  await convite(a.id, convidado, dono);
  expect(await atendimentoParaAbrir(convidado, { leadId: c.lead.id })).toEqual({ atendimentoId: a.id, aberta: true });
  expect(await atendimentoParaAbrir(convidado, { atendimentoId: b.id })).toBeNull();
  expect((await atendimentosParaPessoas(convidado, [c.pessoa.id])).get(c.pessoa.id)).toEqual({ atendimentoId: a.id, aberta: true });
  expect(await atendimentoParaAbrir(convidado, { atendimentoId: b.id, pessoaId: c.pessoa.id })).toEqual({ atendimentoId: a.id, aberta: true });
});
it("convite somente leitura serve; revogação e expiração removem o atalho", async () => {
  const dono = await criarUsuario([Papel.VENDEDOR]), u = await criarUsuario([Papel.PROFESSOR]), c = await contexto(dono), a = await atendimento(c, null);
  const p = await convite(a.id, u, dono);
  expect(await atendimentoParaAbrir(u, { atendimentoId: a.id })).toEqual({ atendimentoId: a.id, aberta: true });
  await prisma.participanteAtendimentoWhatsApp.update({ where: { id: p.id }, data: { revogadoEm: new Date() } });
  expect(await atendimentoParaAbrir(u, { pessoaId: c.pessoa.id })).toBeNull();
  await prisma.participanteAtendimentoWhatsApp.update({ where: { id: p.id }, data: { revogadoEm: null, fim: new Date(Date.now() - 1) } });
  expect(await atendimentoParaAbrir(u, { atendimentoId: a.id })).toBeNull();
});
it("papel fora do Inbox não ganha atalho nem como participante", async () => {
  const dono = await criarUsuario([Papel.ADMINISTRADOR]), u = await criarUsuario([Papel.ALUNO]), c = await contexto(dono), a = await atendimento(c, null);
  await convite(a.id, u, dono);
  expect(await atendimentoParaAbrir(u, { atendimentoId: a.id, pessoaId: c.pessoa.id })).toBeNull();
});
it("empate usa id SQL decrescente; ultimaMensagemEm nula fica depois", async () => {
  const u = await criarUsuario([Papel.ADMINISTRADOR]), c = await contexto(u);
  await atendimento(c, null, "EM_ATENDIMENTO", true, "zz-nulo-336");
  await atendimento(c, "2026-10-22T12:00Z", "EM_ATENDIMENTO", true, "a-336");
  await atendimento(c, "2026-10-22T12:00Z", "EM_ATENDIMENTO", true, "z-336");
  expect(await atendimentoParaAbrir(u, { leadId: c.lead.id })).toEqual({ atendimentoId: "z-336", aberta: true });
});
it("troca de dono da linha sem lead revoga acesso anterior", async () => {
  const u = await criarUsuario([Papel.VENDEDOR]), outro = await criarUsuario([Papel.VENDEDOR]), c = await contexto(u);
  await prisma.numeroWhatsApp.update({ where: { id: c.numero.id }, data: { finalidade: "VENDAS", donoId: u.id } });
  const a = await atendimento(c, null, "EM_ATENDIMENTO", false);
  await prisma.atendimentoWhatsApp.update({ where: { id: a.id }, data: { responsavelId: u.id } });
  expect(await atendimentoParaAbrir(u, { atendimentoId: a.id })).toEqual({ atendimentoId: a.id, aberta: true });
  await prisma.numeroWhatsApp.update({ where: { id: c.numero.id }, data: { donoId: outro.id } });
  expect(await atendimentoParaAbrir(u, { atendimentoId: a.id })).toBeNull();
});
it("grupo permanece sem atendimento e não vira alvo por ID conhecido", async () => {
  const u = await criarUsuario([Papel.ADMINISTRADOR]), c = await contexto(u);
  const grupo = await prisma.grupoWhatsApp.create({ data: { numeroId: c.numero.id, grupoJid: "336@g.us", nome: "Grupo fictício" } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: c.numero.id, grupoId: grupo.id } });
  expect(await atendimentoParaAbrir(u, { atendimentoId: conversa.id })).toBeNull();
  expect(await prisma.atendimentoWhatsApp.count({ where: { conversaId: conversa.id } })).toBe(0);
});
it("lote B2B alcança pessoa antiga após mais de100 candidatos de outra, sem cap global", async () => {
  const u = await criarUsuario([Papel.ADMINISTRADOR]), a = await contexto(u), b = await contexto(u);
  await prisma.atendimentoWhatsApp.createMany({ data: Array.from({ length: 105 }, (_, i) => ({
    conversaId: a.conversa.id, contextoChave: "COMERCIAL::lote336-" + i, finalidade: "COMERCIAL", status: "EM_ATENDIMENTO",
    ultimaMensagemEm: new Date("2026-10-22T12:00Z"),
  })) });
  const antiga = await atendimento(b, "2026-10-01T12:00Z", "EM_ATENDIMENTO", false);
  const mapa = await atendimentosParaPessoas(u, [a.pessoa.id, b.pessoa.id]);
  expect(mapa.size).toBe(2); expect(mapa.get(b.pessoa.id)).toEqual({ atendimentoId: antiga.id, aberta: true });
});
it("lote aplica o escopo a cada pessoa e não usa uma consulta por participante", async () => {
  const u = await criarUsuario([Papel.ADMINISTRADOR]), cs = [];
  for (let i = 0; i < 8; i++) { const c = await contexto(u); cs.push(c); await atendimento(c, "2026-10-22T12:00Z"); }
  const consultas = vi.spyOn(prisma.atendimentoWhatsApp, "findMany");
  const individuais = vi.spyOn(prisma.atendimentoWhatsApp, "findFirst");
  try {
    expect((await atendimentosParaPessoas(u, cs.map(c => c.pessoa.id))).size).toBe(8);
    expect(consultas).toHaveBeenCalledTimes(1); expect(individuais).not.toHaveBeenCalled();
  } finally { consultas.mockRestore(); individuais.mockRestore(); }
});
it("lote e escopo usam a mesma transação com pool1 real", async () => {
  const dono = await criarUsuario([Papel.VENDEDOR]), u = await criarUsuario([Papel.VENDEDOR]), c = await contexto(dono), a = await atendimento(c, null);
  await convite(a.id, u, dono);
  await prisma.$transaction(async tx => {
    const mapa = await atendimentosParaPessoas(u, [c.pessoa.id], tx);
    expect(mapa.get(c.pessoa.id)).toEqual({ atendimentoId: a.id, aberta: true });
  });
});
