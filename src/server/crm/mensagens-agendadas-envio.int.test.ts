import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriverWhatsApp, Papel } from "@prisma/client";

// D12 (#202 C3): a mensagem agendada pelo CRM só abre o atendimento quando sai. Este arquivo liga WHATSAPP_LIVE=1
// com o driver do motor FALSO para exercitar o envio "real" do despachante; nenhuma mensagem sai.
const { authMock, enviarTextoMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  enviarTextoMock: vi.fn().mockResolvedValue({ providerMessageId: "3EB0-agendada", mensagemIdMotor: "c:agendada" }),
}));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/whatsapp/drivers/motor", () => ({
  driverMotor: { enviarTexto: enviarTextoMock, enviarTemplate: vi.fn(), enviarMidia: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { diaUtilAs } from "@/test/janela-envio";
import { despacharFila } from "@/server/whatsapp/despachante";
import { agendarMensagem } from "./mensagens-agendadas";

const FUSO = "America/Costa_Rica";
const logadoComo = (id: string) => authMock.mockResolvedValue({ user: { id } });

beforeEach(async () => {
  await truncarBanco();
  vi.stubEnv("WHATSAPP_LIVE", "1");
  enviarTextoMock.mockClear();
  await prisma.configuracaoOperacional.upsert({
    where: { id: "escola" }, create: { id: "escola", fusoInstitucional: FUSO }, update: { fusoInstitucional: FUSO },
  });
});
afterEach(() => { vi.unstubAllEnvs(); });

async function cenario() {
  const vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  const numero = await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511955558001", rotulo: "Vendas", driver: DriverWhatsApp.MOTOR, finalidade: "VENDAS", providerRef: "inst-env", donoId: vendedor.id },
  });
  const pessoa = await prisma.pessoa.create({ data: { nome: "Ana" } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688881001", pessoaId: pessoa.id } });
  const lead = await prisma.oportunidade.create({ data: { nome: "Ana", vendedorDonoId: vendedor.id, pessoaId: pessoa.id, telefoneE164: contato.telefoneE164 } });
  logadoComo(vendedor.id);
  const quando = diaUtilAs(10, FUSO);
  const r = await agendarMensagem({ numeroId: numero.id, texto: "Lembrete", agendadaPara: quando.toISOString(), leadId: lead.id });
  if (!r.ok) throw new Error(r.erro);
  return { vendedor, numero, contato, lead, quando, intencaoId: r.dado!.id };
}

describe("mensagem agendada pelo CRM × atendimento (D12, #202 C3)", () => {
  it("antes da hora não há atendimento; no envio o atendimento nasce com o lead e recebe a mensagem", async () => {
    const c = await cenario();
    await despacharFila(new Date(c.quando.getTime() - 60_000));
    expect(await prisma.atendimentoWhatsApp.count()).toBe(0);

    const r = await despacharFila(new Date(c.quando.getTime() + 60_000), { intencaoId: c.intencaoId });
    expect(r.despachadas).toBe(1);
    expect(enviarTextoMock).toHaveBeenCalledTimes(1);
    const atendimentos = await prisma.atendimentoWhatsApp.findMany();
    expect(atendimentos).toHaveLength(1);
    expect(atendimentos[0]).toMatchObject({ finalidade: "COMERCIAL", leadId: c.lead.id });
    const it = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.intencaoId } });
    expect(it).toMatchObject({ status: "DESPACHADA", atendimentoId: atendimentos[0].id });
    expect(await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: it.mensagemId! } })).toMatchObject({ atendimentoId: atendimentos[0].id, origem: "HUMANO" });
  });

  it("autor que perdeu a carteira até a hora do envio: cancela sem abrir atendimento", async () => {
    const c = await cenario();
    const outro = await criarUsuario([Papel.VENDEDOR], "Outro");
    await prisma.oportunidade.update({ where: { id: c.lead.id }, data: { vendedorDonoId: outro.id } });
    await despacharFila(new Date(c.quando.getTime() + 60_000), { intencaoId: c.intencaoId });
    expect(enviarTextoMock).not.toHaveBeenCalled();
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: c.intencaoId } })).toMatchObject({ status: "CANCELADA", motivoFalha: "atendimento_sem_acesso" });
    expect(await prisma.atendimentoWhatsApp.count()).toBe(0);
  });

  it("contato cujo telefone não bate com o da oportunidade: cancela sem abrir atendimento (R1 do #254, C3)", async () => {
    const vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
    const numero = await prisma.numeroWhatsApp.create({
      data: { telefoneE164: "+5511955558002", rotulo: "Vendas", driver: DriverWhatsApp.MOTOR, finalidade: "VENDAS", providerRef: "inst-env2", donoId: vendedor.id },
    });
    const pessoa = await prisma.pessoa.create({ data: { nome: "Bia" } });
    // O contato da pessoa (o mais antigo) é o escolhido, mas a oportunidade tem outro telefone.
    await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688882001", pessoaId: pessoa.id } });
    const lead = await prisma.oportunidade.create({ data: { nome: "Bia", vendedorDonoId: vendedor.id, pessoaId: pessoa.id, telefoneE164: "+50688882999" } });
    logadoComo(vendedor.id);
    const quando = diaUtilAs(10, FUSO);
    const r = await agendarMensagem({ numeroId: numero.id, texto: "Lembrete", agendadaPara: quando.toISOString(), leadId: lead.id });
    if (!r.ok) throw new Error(r.erro);
    await despacharFila(new Date(quando.getTime() + 60_000), { intencaoId: r.dado!.id });
    expect(enviarTextoMock).not.toHaveBeenCalled();
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: r.dado!.id } })).toMatchObject({ status: "CANCELADA", motivoFalha: "destinatario_alterado", atendimentoId: null });
    expect(await prisma.atendimentoWhatsApp.count()).toBe(0);
    expect(await prisma.conversaWhatsApp.count()).toBe(0);
  });

  it("cancelada antes da hora nunca abre atendimento", async () => {
    const c = await cenario();
    await prisma.intencaoMensagem.update({ where: { id: c.intencaoId }, data: { status: "CANCELADA" } });
    await despacharFila(new Date(c.quando.getTime() + 60_000));
    expect(await prisma.atendimentoWhatsApp.count()).toBe(0);
  });
});
