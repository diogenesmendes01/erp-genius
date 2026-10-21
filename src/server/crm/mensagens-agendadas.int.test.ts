import { DriverWhatsApp } from "@prisma/client";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { diaUtilAs } from "@/test/janela-envio";
import { mensagemForaDaJanela } from "@/server/whatsapp/janela-envio";
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
// D12: o agendamento só vale dentro da janela de envio (fábrica: 9h–20h, segunda a sexta) no fuso da escola.
const FUSO = "America/Costa_Rica";
const util = (hora: number, minutos = 0) => diaUtilAs(hora, FUSO, minutos).toISOString();

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
    data: { telefoneE164: "+5511955550001", rotulo: "Vendas", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", providerRef: "inst-ag" },
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
    await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511955550002", rotulo: "Do outro", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", providerRef: "i2", donoId: outro.id } });
    await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511955550003", rotulo: "Cobrança", driver: DriverWhatsApp.BAILEYS, finalidade: "COBRANCA", providerRef: "i3" } });
    await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511955550004", rotulo: "Meu", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", providerRef: "i4", donoId: vendedor.id } });
    const u = await exigirSessao();
    const r = await numerosParaAgendar(u);
    expect(r.map((n) => n.rotulo).sort()).toEqual(["Meu", "Vendas"]);
  });
});

describe("agendarMensagem", () => {
  it("só agenda com contato WhatsApp, sem opt-out e no futuro", async () => {
    logadoComo(vendedor.id);
    const amanha = util(10);
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
    const r = await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: util(10), leadId });
    expect(r.ok).toBe(true);
    expect((await eventosDo("Lead", leadId)).map((e) => e.tipo)).toContain("MensagemAgendada");
    const alheio = (await prisma.oportunidade.create({ data: { nome: "Alheia", vendedorDonoId: outro.id, pessoaId } })).id;
    expect(await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: util(10), leadId: alheio })).toEqual({ ok: false, erro: "Oportunidade fora da sua carteira." });
  });

  it("número do outro vendedor ou texto vazio são recusados", async () => {
    const n = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511955550009", rotulo: "Do outro", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", providerRef: "i9", donoId: outro.id } });
    expect((await agendarMensagem({ numeroId: n.id, texto: "Oi", agendadaPara: util(10), pessoaId })).ok).toBe(false);
    expect(await agendarMensagem({ numeroId, texto: "  ", agendadaPara: util(10), pessoaId })).toEqual({ ok: false, erro: "Escreva a mensagem." });
  });
});

describe("D12: atendimento só no envio e recusa fora da janela", () => {
  it("agendar pelo CRM não cria atendimento: a intenção espera sem atendimento até sair (#202 C3)", async () => {
    const r = await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: util(10), leadId, tarefaId });
    expect(r.ok).toBe(true);
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: idDe(r) } })).toMatchObject({ atendimentoId: null, leadId, status: "PENDENTE" });
    expect(await prisma.atendimentoWhatsApp.count()).toBe(0);
    expect(await prisma.conversaWhatsApp.count()).toBe(0);
  });

  it("recusa agendar no horário de silêncio e no fim de semana, com a janela no fuso da escola (#202 C4)", async () => {
    const recusa = mensagemForaDaJanela({ janelaInicio: 9, janelaFim: 20, diasSemana: [1, 2, 3, 4, 5] }, FUSO);
    expect(recusa).toContain("das 9h às 20h, de segunda a sexta (horário de America/Costa_Rica)");
    expect(await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: util(3), leadId })).toEqual({ ok: false, erro: recusa });
    expect(await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: util(20), leadId })).toEqual({ ok: false, erro: recusa });
    // 19h de sábado: dentro do horário, fora dos dias.
    const sabado = new Date(diaUtilAs(10, FUSO).getTime());
    while (new Intl.DateTimeFormat("en-US", { timeZone: FUSO, weekday: "short" }).format(sabado) !== "Sat") sabado.setTime(sabado.getTime() + 86_400_000);
    expect(await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: sabado.toISOString(), leadId })).toEqual({ ok: false, erro: recusa });
    expect(await prisma.intencaoMensagem.count()).toBe(0);
    // A janela é a da política que o despachante aplica: mudar a política muda a recusa.
    await prisma.politicaRegua.create({ data: { nome: "Cobrança", escopo: "COBRANCA", janelaInicio: 2, janelaFim: 6, diasSemana: [0, 1, 2, 3, 4, 5, 6] } });
    expect((await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: util(3), leadId })).ok).toBe(true);
    expect(await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: util(10), leadId })).toEqual({
      ok: false, erro: mensagemForaDaJanela({ janelaInicio: 2, janelaFim: 6, diasSemana: [0, 1, 2, 3, 4, 5, 6] }, FUSO),
    });
  });

  it("reagendar para fora da janela também é recusado e mantém a data", async () => {
    const quando = util(11);
    const m = idDe(await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: quando, pessoaId, tarefaId }));
    expect(await reagendarMensagem(m, util(5))).toEqual({ ok: false, erro: expect.stringContaining("Fora da janela de envio da escola") });
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: m } })).agendadaPara?.toISOString()).toBe(quando);
  });
});

describe("reagendar, cancelar e enviar agora", () => {
  async function nova() {
    const r = await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: util(11), pessoaId, tarefaId });
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
    const nova1 = util(15);
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
    const m = idDe(await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: util(10), pessoaId, tarefaId }));
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
    await agendarMensagem({ numeroId, texto: "Oi", agendadaPara: "2099-06-15T16:00:00.000Z", pessoaId });
    const u = await exigirSessao();
    expect((await listarItensAgenda(u, { de: "2099-06-15", ate: "2099-06-15" }, false)).filter((i) => i.tipo === "mensagem")).toHaveLength(1);
    expect((await listarItensAgenda(u, { de: "2099-06-16", ate: "2099-06-20" }, false)).filter((i) => i.tipo === "mensagem")).toHaveLength(0);
  });
});
