import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { exigirSessao } from "@/server/_shared/sessao";
import { criarTarefa } from "./tarefas";
import {
  numerosParaAgendar, agendarMensagem, reagendarMensagem, cancelarMensagemAgendada, enviarAgora, listarItensAgenda,
} from "./mensagens-agendadas";

function logadoComo(id: string) {
  authMock.mockResolvedValue({ user: { id } });
}
function idDe(r: { ok: boolean; dado?: { id: string } }): string {
  if (!r.ok || !r.dado) throw new Error("agendarMensagem falhou");
  return r.dado.id;
}
const emHoras = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let outro: Awaited<ReturnType<typeof criarUsuario>>;
let gerente: Awaited<ReturnType<typeof criarUsuario>>;
let numeroId: string;
let pessoaId: string;
let pessoaSemTelefone: string;
let pessoaOptOut: string;
let leadId: string;
let tarefaId: string;

beforeEach(async () => {
  await truncarBanco();
  await prisma.configuracaoOperacional.upsert({
    where: { id: "escola" },
    create: { id: "escola", fusoInstitucional: "America/Costa_Rica" },
    update: { fusoInstitucional: "America/Costa_Rica" },
  });
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  outro = await criarUsuario([Papel.VENDEDOR], "Outro");
  await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
  numeroId = (await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511955550001", rotulo: "Vendas", driver: "BAILEYS", finalidade: "VENDAS", providerRef: "inst-ag" },
  })).id;
  pessoaId = (await prisma.pessoa.create({ data: { nome: "Ana" } })).id;
  await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001", pessoaId } });
  pessoaSemTelefone = (await prisma.pessoa.create({ data: { nome: "Sem fone" } })).id;
  pessoaOptOut = (await prisma.pessoa.create({ data: { nome: "Optout" } })).id;
  await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880002", pessoaId: pessoaOptOut, optOutEm: new Date() } });
  leadId = (await prisma.oportunidade.create({ data: { nome: "Minha", vendedorDonoId: vendedor.id, pessoaId } })).id;
  logadoComo(vendedor.id);
  const t = await criarTarefa({ titulo: "Mandar oi", tipo: "WHATSAPP", leadId });
  tarefaId = idDe(t);
});

describe("numerosParaAgendar", () => {
  it("só VENDAS sem dono ou do próprio usuário", async () => {
    await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511955550002", rotulo: "Do outro", driver: "BAILEYS", finalidade: "VENDAS", providerRef: "i2", donoId: outro.id } });
    await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511955550003", rotulo: "Cobrança", driver: "BAILEYS", finalidade: "COBRANCA", providerRef: "i3" } });
    await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511955550004", rotulo: "Meu", driver: "BAILEYS", finalidade: "VENDAS", providerRef: "i4", donoId: vendedor.id } });
    const u = await exigirSessao();
    const r = await numerosParaAgendar(u);
    expect(r.map((n) => n.rotulo).sort()).toEqual(["Meu", "Vendas"]);
  });
});

describe("agendarMensagem", () => {
  it("só agenda com contato WhatsApp, sem opt-out e no futuro", async () => {
    logadoComo(vendedor.id);
    const amanha = emHoras(24);
    expect(await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: amanha, pessoaId: pessoaSemTelefone })).toEqual({ ok: false, erro: "Este contato não tem WhatsApp cadastrado." });
    expect(await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: amanha, pessoaId: pessoaOptOut })).toEqual({ ok: false, erro: "Contato pediu para não receber mensagens." });
    expect(await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: emHoras(-24), pessoaId })).toEqual({ ok: false, erro: "Escolha uma data e hora no futuro." });
    const r = await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: amanha, pessoaId, tarefaId });
    expect(r.ok).toBe(true);
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: idDe(r) } })).toMatchObject({
      origem: "HUMANO", status: "PENDENTE", tarefaId, autorId: vendedor.id, corpoRenderizado: "Oi",
    });
    expect((await eventosDo("Tarefa", tarefaId)).map((e) => e.tipo)).toContain("MensagemAgendada");
  });

  it("pela oportunidade grava o evento no Lead; fora da carteira é recusado", async () => {
    const r = await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: emHoras(2), leadId });
    expect(r.ok).toBe(true);
    expect((await eventosDo("Lead", leadId)).map((e) => e.tipo)).toContain("MensagemAgendada");
    const alheio = (await prisma.oportunidade.create({ data: { nome: "Alheia", vendedorDonoId: outro.id, pessoaId } })).id;
    expect(await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: emHoras(2), leadId: alheio })).toEqual({ ok: false, erro: "Oportunidade fora da sua carteira." });
  });

  it("número do outro vendedor ou texto vazio são recusados", async () => {
    const n = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511955550009", rotulo: "Do outro", driver: "BAILEYS", finalidade: "VENDAS", providerRef: "i9", donoId: outro.id } });
    expect((await agendarMensagem({ numeroId: n.id, texto: "Oi", agendadaPara: emHoras(2), pessoaId })).ok).toBe(false);
    expect(await agendarMensagem({ numeroId, texto: "  ", agendadaPara: emHoras(2), pessoaId })).toEqual({ ok: false, erro: "Escreva a mensagem." });
  });
});

describe("reagendar, cancelar e enviar agora", () => {
  async function nova() {
    const r = await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: emHoras(5), pessoaId, tarefaId });
    return idDe(r);
  }

  it("cancelar só enquanto PENDENTE/ADIADA", async () => {
    const m = await nova();
    await prisma.intencaoMensagem.update({ where: { id: m }, data: { status: "ENVIANDO" } });
    expect(await cancelarMensagemAgendada(m)).toEqual({ ok: false, erro: "A mensagem já está sendo enviada." });
    await prisma.intencaoMensagem.update({ where: { id: m }, data: { status: "ADIADA" } });
    expect(await cancelarMensagemAgendada(m)).toEqual({ ok: true });
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: m } })).status).toBe("CANCELADA");
    expect((await eventosDo("Tarefa", tarefaId)).map((e) => e.tipo)).toContain("MensagemAgendadaCancelada");
  });

  it("reagendar exige futuro e muda a data", async () => {
    const m = await nova();
    expect(await reagendarMensagem(m, emHoras(-1))).toEqual({ ok: false, erro: "Escolha uma data e hora no futuro." });
    const nova1 = emHoras(10);
    expect(await reagendarMensagem(m, nova1)).toEqual({ ok: true });
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: m } })).agendadaPara?.toISOString()).toBe(new Date(nova1).toISOString());
    expect((await eventosDo("Tarefa", tarefaId)).map((e) => e.tipo)).toContain("MensagemReagendada");
  });

  it("enviar agora vira agendadaPara = agora; outro usuário não mexe", async () => {
    const m = await nova();
    logadoComo(outro.id);
    expect((await enviarAgora(m)).ok).toBe(false);
    logadoComo(vendedor.id);
    const antes = Date.now();
    expect(await enviarAgora(m)).toEqual({ ok: true });
    const t = (await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: m } })).agendadaPara!.getTime();
    expect(t).toBeGreaterThanOrEqual(antes - 1000);
    expect(t).toBeLessThanOrEqual(Date.now() + 1000);
  });
});

describe("listarItensAgenda", () => {
  it("junta tarefas e mensagens HUMANO agendadas; ignora réguas; escopo por autor", async () => {
    const m = idDe(await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: emHoras(2), pessoaId, tarefaId }));
    const contato = await prisma.contatoWhatsApp.findFirstOrThrow({ where: { pessoaId } });
    await prisma.intencaoMensagem.create({ data: { numeroId, contatoId: contato.id, origem: "HUMANO", corpoRenderizado: "regua", agendadaPara: new Date(Date.now() + 3600_000), passoComercial: "+30min", leadId } });
    await prisma.intencaoMensagem.create({ data: { numeroId, contatoId: contato.id, origem: "HUMANO", corpoRenderizado: "imediata", autorId: vendedor.id } });
    await prisma.tarefa.update({ where: { id: tarefaId }, data: { dataCivil: "2026-10-20" } });
    const intervalo = { de: "2020-01-01", ate: "2099-12-31" };
    const u = await exigirSessao();
    const itens = await listarItensAgenda(u, intervalo, false);
    const msgs = itens.filter((i) => i.tipo === "mensagem");
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ id: m, texto: "Oi", status: "PENDENTE", nomeContato: "Ana" });
    expect(itens.filter((i) => i.tipo === "tarefa")).toHaveLength(1);

    logadoComo(outro.id);
    const uo = await exigirSessao();
    expect((await listarItensAgenda(uo, intervalo, false)).filter((i) => i.tipo === "mensagem")).toHaveLength(0);

    logadoComo(gerente.id);
    const ug = await exigirSessao();
    expect((await listarItensAgenda(ug, intervalo, false)).filter((i) => i.tipo === "mensagem")).toHaveLength(0);
    expect((await listarItensAgenda(ug, intervalo, true)).filter((i) => i.tipo === "mensagem")).toHaveLength(1);
  });

  it("respeita o intervalo", async () => {
    await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: "2099-06-15T12:00:00.000Z", pessoaId });
    const u = await exigirSessao();
    expect((await listarItensAgenda(u, { de: "2099-06-15", ate: "2099-06-15" }, false)).filter((i) => i.tipo === "mensagem")).toHaveLength(1);
    expect((await listarItensAgenda(u, { de: "2099-06-16", ate: "2099-06-20" }, false)).filter((i) => i.tipo === "mensagem")).toHaveLength(0);
  });
});
