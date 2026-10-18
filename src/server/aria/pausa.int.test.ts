import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock, enviarTextoMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  enviarTextoMock: vi.fn().mockResolvedValue({ providerMessageId: "3EB0-pausa", mensagemIdMotor: "c:3EB0-pausa" }),
}));
vi.mock("@/server/whatsapp/drivers/motor", () => ({ driverMotor: { enviarTexto: enviarTextoMock, enviarTemplate: vi.fn(), enviarMidia: vi.fn() } }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { processarMensagemNormalizada, type InboundNormalizado } from "@/server/whatsapp/inbound";
import { enviarTextoInbox } from "@/server/whatsapp/acoes";
import { despacharFila } from "@/server/whatsapp/despachante";
import { aoGravarSaidaHumana, devolverParaAria, pausarAriaNoAtendimento } from "./pausa";

beforeEach(async () => {
  await truncarBanco();
  authMock.mockReset();
  enviarTextoMock.mockClear();
  vi.stubEnv("WHATSAPP_LIVE", "1");
});
afterEach(() => vi.unstubAllEnvs());

type U = Awaited<ReturnType<typeof criarUsuario>>;
const logado = (u: U) => authMock.mockResolvedValue({ user: { id: u.id } });

async function cenario() {
  const responsavel = await criarUsuario([Papel.VENDEDOR]);
  const outroVendedor = await criarUsuario([Papel.VENDEDOR]);
  const { numero } = await seedCanal({ estado: "ATIVA" });
  const lead = await prisma.oportunidade.create({ data: { nome: "Maria", telefoneE164: "+50688888888", vendedorDonoId: responsavel.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: lead.telefoneE164!, leadId: lead.id } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id }));
  return { responsavel, outroVendedor, numero, a };
}

const iaPausa = (id: string) =>
  prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id }, select: { iaPausadaEm: true, iaPausaMotivo: true, iaRetomadaEm: true, iaRetomadaPorId: true } });
const eventosTipo = async (atendimentoId: string, tipo: string) =>
  (await eventosDo("AtendimentoWhatsApp", atendimentoId)).filter((e) => e.tipo === tipo);

async function enviarComoAtendente(c: Awaited<ReturnType<typeof cenario>>) {
  logado(c.responsavel);
  expect((await enviarTextoInbox({ conversaId: c.a.id, texto: "Olá, sou a atendente" })).ok).toBe(true);
  await despacharFila();
}

describe("pausa da Aria quando humano responde", () => {
  it("resposta_humana_pausa", async () => {
    const c = await cenario();
    await enviarComoAtendente(c);
    expect(await iaPausa(c.a.id)).toMatchObject({ iaPausaMotivo: "HUMANO_RESPONDEU" });
    expect((await iaPausa(c.a.id)).iaPausadaEm).not.toBeNull();
  });

  it("resposta_pelo_celular_pausa", async () => {
    const c = await cenario();
    const inbound: InboundNormalizado = {
      numeroTelefoneE164: c.numero.telefoneE164, contatoWaId: "50688888888", providerMessageId: "eco-pausa", corpo: "Oi do celular",
      tipo: "TEXTO", driver: "MOTOR", fromMe: true, quando: new Date("2026-10-16T12:00:00Z"),
    };
    await processarMensagemNormalizada(inbound);
    expect(await iaPausa(c.a.id)).toMatchObject({ iaPausaMotivo: "CELULAR" });
  });

  it("mensagem_da_propria_aria_nao_pausa", async () => {
    const c = await cenario();
    await prisma.$transaction((tx) => aoGravarSaidaHumana(tx, { atendimentoId: c.a.id, origem: "IA", autorId: null }));
    expect((await iaPausa(c.a.id)).iaPausadaEm).toBeNull();
    await prisma.$transaction((tx) => aoGravarSaidaHumana(tx, { atendimentoId: null, origem: "HUMANO", autorId: null }));
    expect(await eventosTipo(c.a.id, "AriaPausadaNoAtendimento")).toHaveLength(0);
  });

  it("pausa_e_idempotente", async () => {
    const c = await cenario();
    await enviarComoAtendente(c);
    await enviarComoAtendente(c);
    expect(await eventosTipo(c.a.id, "AriaPausadaNoAtendimento")).toHaveLength(1);
    const de = await prisma.$transaction((tx) => pausarAriaNoAtendimento(tx, c.a.id, "MANUAL", null));
    expect(de).toBe(false);
    expect((await iaPausa(c.a.id)).iaPausaMotivo).toBe("HUMANO_RESPONDEU");
  });

  it("devolver_so_quem_ve_o_atendimento", async () => {
    const c = await cenario();
    await enviarComoAtendente(c);
    logado(c.outroVendedor);
    expect((await devolverParaAria(c.a.id)).ok).toBe(false);
    expect((await iaPausa(c.a.id)).iaPausadaEm).not.toBeNull();
    logado(c.responsavel);
    expect((await devolverParaAria(c.a.id)).ok).toBe(true);
    expect(await iaPausa(c.a.id)).toMatchObject({ iaPausadaEm: null, iaRetomadaPorId: c.responsavel.id });
    expect((await iaPausa(c.a.id)).iaRetomadaEm).not.toBeNull();
    expect(await eventosTipo(c.a.id, "AriaDevolvida")).toHaveLength(1);
  });

  it("devolver_exige_escopo_de_envio", async () => {
    const c = await cenario();
    await enviarComoAtendente(c);
    // Linha inativa: o responsável ainda LÊ o atendimento, mas não pode enviar por ele.
    await prisma.numeroWhatsApp.update({ where: { id: c.numero.id }, data: { ativo: false } });
    logado(c.responsavel);
    expect((await devolverParaAria(c.a.id)).ok).toBe(false);
    expect((await iaPausa(c.a.id)).iaPausadaEm).not.toBeNull();
    expect(await eventosTipo(c.a.id, "AriaDevolvida")).toHaveLength(0);
  });

  it("pausa_cancela_intencoes_pendentes_da_aria_e_preserva_as_demais", async () => {
    const c = await cenario();
    const at = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.a.id }, include: { conversa: true } });
    const base = { numeroId: at.conversa.numeroId, contatoId: at.conversa.contatoId!, atendimentoId: c.a.id, tipo: "TEXTO" as const };
    const iaPendente = await prisma.intencaoMensagem.create({ data: { ...base, origem: "IA", corpoRenderizado: "resposta" } });
    const iaAdiada = await prisma.intencaoMensagem.create({ data: { ...base, origem: "IA", status: "ADIADA", corpoRenderizado: "agendada pela Aria" } });
    const iaHandoff = await prisma.intencaoMensagem.create({ data: { ...base, origem: "IA", corpoRenderizado: "vou te passar" } });
    const humana = await prisma.intencaoMensagem.create({ data: { ...base, origem: "HUMANO", autorId: c.responsavel.id, corpoRenderizado: "oi" } });
    await prisma.$transaction((tx) => pausarAriaNoAtendimento(tx, c.a.id, "HANDOFF", null, { preservarIntencaoId: iaHandoff.id }));
    const st = async (id: string) => prisma.intencaoMensagem.findUniqueOrThrow({ where: { id }, select: { status: true, motivoFalha: true } });
    expect(await st(iaPendente.id)).toEqual({ status: "CANCELADA", motivoFalha: "aria_pausada" });
    expect(await st(iaAdiada.id)).toEqual({ status: "CANCELADA", motivoFalha: "aria_pausada" });
    expect(await st(iaHandoff.id)).toMatchObject({ status: "PENDENTE" });
    expect(await st(humana.id)).toMatchObject({ status: "PENDENTE" });
    // Já pausada: uma pessoa que responde depois ainda cancela o que restou da Aria.
    await prisma.$transaction((tx) => aoGravarSaidaHumana(tx, { atendimentoId: c.a.id, origem: "CELULAR", autorId: null }));
    expect(await st(iaHandoff.id)).toEqual({ status: "CANCELADA", motivoFalha: "aria_pausada" });
    expect(await st(humana.id)).toMatchObject({ status: "PENDENTE" });
  });

  it("devolver_sem_pausa_nao_faz_nada", async () => {
    const c = await cenario();
    logado(c.responsavel);
    expect((await devolverParaAria(c.a.id)).ok).toBe(true);
    expect(await eventosTipo(c.a.id, "AriaDevolvida")).toHaveLength(0);
  });
});
