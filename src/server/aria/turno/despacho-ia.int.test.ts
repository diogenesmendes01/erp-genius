import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { enviarTextoMock } = vi.hoisted(() => ({
  enviarTextoMock: vi.fn(),
}));
vi.mock("@/server/whatsapp/drivers/motor", () => ({ driverMotor: { enviarTexto: enviarTextoMock, enviarTemplate: vi.fn(), enviarMidia: vi.fn() } }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { despacharFila } from "@/server/whatsapp/despachante";
import { configPadrao } from "../config-schema";
import { provedorSimulado } from "../provedor/simulado";
import type { PedidoIA, ProvedorIA, RespostaIA } from "../provedor/tipos";
import { processarTurnoAria } from "./orquestrador";

// Revisão final da Fase 5C (achado 1): a resposta da Aria ATIVA passa pelo despachante de verdade.
// O ensaio dela é o estado da própria Aria, nunca o saudacaoEstado da ConfigComercial (padrão DESLIGADA).

let seq = 0;
beforeEach(async () => {
  await truncarBanco();
  enviarTextoMock.mockReset();
  enviarTextoMock.mockImplementation(async () => ({ providerMessageId: `3EB0-ia-${++seq}`, mensagemIdMotor: `c:3EB0-ia-${seq}` }));
  vi.stubEnv("WHATSAPP_LIVE", "1");
});
afterEach(() => vi.unstubAllEnvs());

const provedor: ProvedorIA = {
  nome: "simulado",
  async gerar(p: PedidoIA): Promise<RespostaIA> {
    // Parte da resposta do provedor simulado real: herda campos novos de RespostaIA (ex.: tokensEscritaCache).
    return {
      ...(await provedorSimulado.gerar(p)),
      texto: JSON.stringify({ resposta: "Temos turmas à noite, quer conhecer?", documentoId: null, acoes: [], confianca: 95, handoff: null, fontes: [], humor: null }),
    };
  },
};

async function cenario(estado: "ATIVA" | "SHADOW") {
  const cat = await seedCatalogoMinimo();
  const dono = await criarUsuario([], "Camila Souza");
  const { numero } = await seedCanal({ estado: "ATIVA" });
  const op = await prisma.oportunidade.create({ data: { nome: "Maria", paisId: cat.pais.id, telefoneE164: "+50688888888", vendedorDonoId: dono.id } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688888888", leadId: op.id, nomeExibicao: "Maria" } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: op.id }));
  const { conversaId } = await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: at.id }, select: { conversaId: true } });
  await prisma.versaoAgenteIA.create({ data: { numero: 1, status: "PUBLICADA", config: configPadrao(), criadaPorId: dono.id, publicadaPorId: dono.id, publicadaEm: new Date() } });
  await prisma.agenteIA.upsert({ where: { id: "aria" }, create: { id: "aria", estado }, update: { estado } });
  const inbound = (corpo: string) =>
    prisma.mensagemWhatsApp.create({
      data: { atendimentoId: at.id, conversaId, numeroId: numero.id, direcao: "ENTRADA", corpo, driver: "MOTOR", status: "ENTREGUE", providerMessageId: `di-${++seq}`, criadoEm: new Date(Date.now() - 1000) },
    });
  return { at, inbound };
}

describe("despacho da resposta da Aria", () => {
  it("aria_ativa_envia_de_verdade_com_a_saudacao_comercial_desligada", async () => {
    const c = await cenario("ATIVA");
    expect(await prisma.configComercial.findUnique({ where: { id: "comercial" } })).toBeNull(); // saudacaoEstado = DESLIGADA (padrão)

    const m1 = await c.inbound("Quero saber das turmas de inglês");
    expect(await processarTurnoAria(m1.id, { provedor })).toMatchObject({ resultado: "RESPONDEU" });
    const r = await despacharFila();
    expect(r).toMatchObject({ despachadas: 1, simuladas: 0, canceladas: 0 });
    expect(enviarTextoMock).toHaveBeenCalledTimes(1);
    expect(enviarTextoMock.mock.calls[0][2]).toBe("Oi! Eu sou a Aria, assistente virtual da escola. Temos turmas à noite, quer conhecer?");
    const intencao1 = await prisma.intencaoMensagem.findFirstOrThrow({ orderBy: { criadaEm: "asc" } });
    expect(intencao1).toMatchObject({ origem: "IA", status: "DESPACHADA" });
    expect(await prisma.mensagemWhatsApp.findUniqueOrThrow({ where: { id: intencao1.mensagemId! } })).toMatchObject({ direcao: "SAIDA", origem: "IA" });
    // A Aria não se pausa com a própria fala.
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.at.id } })).iaPausadaEm).toBeNull();

    // Já apresentada: a resposta seguinte não repete a apresentação.
    const m2 = await c.inbound("E aos sábados?");
    expect(await processarTurnoAria(m2.id, { provedor })).toMatchObject({ resultado: "RESPONDEU" });
    expect(await despacharFila()).toMatchObject({ despachadas: 1 });
    expect(enviarTextoMock.mock.calls[1][2]).toBe("Temos turmas à noite, quer conhecer?");
  });

  it("aria_que_sai_de_ativa_antes_do_despacho_so_simula", async () => {
    const c = await cenario("ATIVA");
    const m = await c.inbound("Quero saber das turmas de inglês");
    await processarTurnoAria(m.id, { provedor });
    await prisma.agenteIA.update({ where: { id: "aria" }, data: { estado: "SHADOW" } });
    expect(await despacharFila()).toMatchObject({ despachadas: 0, simuladas: 1 });
    expect(enviarTextoMock).not.toHaveBeenCalled();
  });

  it("aria_em_shadow_nada_sai_mesmo_com_a_saudacao_comercial_ativa", async () => {
    const c = await cenario("SHADOW");
    await prisma.configComercial.create({ data: { id: "comercial", saudacaoEstado: "ATIVA" } });
    const m = await c.inbound("Quero saber das turmas de inglês");
    await processarTurnoAria(m.id, { provedor });
    expect(await prisma.intencaoMensagem.findFirstOrThrow()).toMatchObject({ origem: "IA", status: "SIMULADA" });
    expect(await despacharFila()).toMatchObject({ avaliadas: 0, despachadas: 0 });
    expect(enviarTextoMock).not.toHaveBeenCalled();
  });
});
