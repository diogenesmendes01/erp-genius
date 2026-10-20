import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { enviarTextoMock, authMock } = vi.hoisted(() => ({
  enviarTextoMock: vi.fn(),
  authMock: vi.fn(),
}));
vi.mock("@/server/whatsapp/drivers/motor", () => ({ driverMotor: { enviarTexto: enviarTextoMock, enviarTemplate: vi.fn(), enviarMidia: vi.fn() } }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { diaUtilAs } from "@/test/janela-envio";
import { seedCanal } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";
import { despacharFila } from "@/server/whatsapp/despachante";
import { enviarTextoInbox } from "@/server/whatsapp/acoes";
import { processarMensagemNormalizada } from "@/server/whatsapp/inbound";
import { Papel } from "@prisma/client";
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
  const dono = await criarUsuario([Papel.VENDEDOR], "Camila Souza");
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
  return { at, inbound, numero, dono };
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

  it("intencao_da_aria_pendente_nao_sai_depois_do_eco_do_celular", async () => {
    const c = await cenario("ATIVA");
    const m = await c.inbound("Quero saber das turmas de inglês");
    expect(await processarTurnoAria(m.id, { provedor })).toMatchObject({ resultado: "RESPONDEU" });
    // A atendente responde pelo celular antes do despachante rodar.
    await processarMensagemNormalizada({
      numeroTelefoneE164: c.numero.telefoneE164, contatoWaId: "50688888888", providerMessageId: `eco-${++seq}`, corpo: "Oi, aqui é a Camila",
      tipo: "TEXTO", driver: "MOTOR", fromMe: true, quando: new Date(),
    });
    expect(await despacharFila()).toMatchObject({ despachadas: 0 });
    expect(enviarTextoMock).not.toHaveBeenCalled();
    expect(await prisma.intencaoMensagem.findFirstOrThrow({ where: { origem: "IA" } })).toMatchObject({ status: "CANCELADA", motivoFalha: "aria_pausada" });
  });

  it("intencao_da_aria_pendente_nao_sai_depois_do_envio_humano_pelo_erp", async () => {
    const c = await cenario("ATIVA");
    const m = await c.inbound("Quero saber das turmas de inglês");
    expect(await processarTurnoAria(m.id, { provedor })).toMatchObject({ resultado: "RESPONDEU" });
    authMock.mockResolvedValue({ user: { id: c.dono.id } });
    expect((await enviarTextoInbox({ conversaId: c.at.id, texto: "Oi, aqui é a Camila" })).ok).toBe(true);
    // O envio pelo ERP sai na hora; o despachante seguinte não tem mais nada da Aria a mandar.
    expect(await despacharFila()).toMatchObject({ despachadas: 0 });
    expect(enviarTextoMock).toHaveBeenCalledTimes(1);
    expect(enviarTextoMock.mock.calls[0][2]).toBe("Oi, aqui é a Camila");
    expect(await prisma.intencaoMensagem.findFirstOrThrow({ where: { origem: "IA" } })).toMatchObject({ status: "CANCELADA", motivoFalha: "aria_pausada" });
  });

  it("despachante_cancela_fala_da_aria_com_atendimento_pausado_mesmo_sem_a_pausa_cancelar", async () => {
    const c = await cenario("ATIVA");
    const m = await c.inbound("Quero saber das turmas de inglês");
    expect(await processarTurnoAria(m.id, { provedor })).toMatchObject({ resultado: "RESPONDEU" });
    // Pausa gravada por fora (sem passar por pausarAriaNoAtendimento): só a defesa do despachante segura.
    await prisma.atendimentoWhatsApp.update({ where: { id: c.at.id }, data: { iaPausadaEm: new Date(), iaPausaMotivo: "MANUAL" } });
    expect(await despacharFila()).toMatchObject({ despachadas: 0, canceladas: 1 });
    expect(enviarTextoMock).not.toHaveBeenCalled();
    expect(await prisma.intencaoMensagem.findFirstOrThrow({ where: { origem: "IA" } })).toMatchObject({ status: "CANCELADA", motivoFalha: "aria_pausada" });
  });

  it("mensagem_do_proprio_handoff_sai", async () => {
    const c = await cenario("ATIVA");
    const m = await c.inbound("Quero falar com um atendente humano");
    const pedeHumano: ProvedorIA = {
      nome: "simulado",
      async gerar(p: PedidoIA) {
        return { ...(await provedorSimulado.gerar(p)), texto: JSON.stringify({ resposta: null, documentoId: null, acoes: [], confianca: 20, handoff: { motivo: "PEDIDO_HUMANO" }, fontes: [], humor: null }) };
      },
    };
    expect(await processarTurnoAria(m.id, { provedor: pedeHumano })).toMatchObject({ resultado: "HANDOFF" });
    expect(await despacharFila()).toMatchObject({ despachadas: 1, canceladas: 0 });
    const msgHandoff = await prisma.intencaoMensagem.findFirstOrThrow({ where: { origem: "IA" } });
    expect(msgHandoff).toMatchObject({ status: "DESPACHADA" });
    expect(enviarTextoMock.mock.calls[0][2]).toBe(msgHandoff.corpoRenderizado);
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

// Vindo da 5D (antes da revisão final da 5C): a mensagem agendada pela Aria antes do handoff não sai,
// e o aviso do próprio handoff sai. Ajustado à regra final (motivo MOTIVO_ARIA_PAUSADA, sem Evento próprio).
describe("mensagem agendada da Aria e o handoff", () => {
  const amanha = () => diaUtilAs(10); // D12: dentro da janela de envio
  const comAgendamento: ProvedorIA = {
    nome: "simulado",
    async gerar(p: PedidoIA): Promise<RespostaIA> {
      const fala = [...p.mensagens].reverse().find((m) => m.papel === "usuario")?.texto.toLowerCase() ?? "";
      const humano = fala.includes("humano");
      return {
        ...(await provedorSimulado.gerar(p)),
        texto: JSON.stringify({
          resposta: humano ? "Certo, vou chamar alguém." : "Combinado, te lembro amanhã.",
          documentoId: null,
          acoes: humano ? [] : [{ acao: "AGENDAR_MENSAGEM", texto: "Oi! Passando para lembrar da aula experimental.", enviarEmISO: amanha().toISOString(), justificativa: "lembrete" }],
          confianca: humano ? 20 : 95,
          handoff: humano ? { motivo: "PEDIDO_HUMANO" } : null,
          fontes: [],
          humor: null,
        }),
      };
    },
  };

  it("aviso_de_handoff_sai_e_mensagem_agendada_antes_do_handoff_nao", async () => {
    const c = await cenario("ATIVA");
    const cfg = configPadrao();
    cfg.matriz = { ...cfg.matriz, NOVO: { ...(cfg.matriz.NOVO ?? {}), RESPONDER: "EXECUTA", AGENDAR_MENSAGEM: "EXECUTA" } };
    await prisma.versaoAgenteIA.updateMany({ data: { config: cfg } });

    const m1 = await c.inbound("Pode me lembrar da aula amanhã?");
    expect(await processarTurnoAria(m1.id, { provedor: comAgendamento })).toMatchObject({ resultado: "RESPONDEU" });
    expect(await despacharFila()).toMatchObject({ despachadas: 1 });

    const m2 = await c.inbound("quero falar com um humano");
    expect(await processarTurnoAria(m2.id, { provedor: comAgendamento })).toMatchObject({ resultado: "HANDOFF" });
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.at.id } })).iaPausaMotivo).toBe("HANDOFF");
    expect(await despacharFila()).toMatchObject({ despachadas: 1, canceladas: 0 });
    expect(enviarTextoMock).toHaveBeenCalledTimes(2);

    await despacharFila(new Date(amanha().getTime() + 3600_000));
    expect(enviarTextoMock).toHaveBeenCalledTimes(2);
    const agendada = await prisma.intencaoMensagem.findFirstOrThrow({ where: { agendadaPara: { not: null } } });
    expect(agendada).toMatchObject({ status: "CANCELADA", motivoFalha: "aria_pausada" });
  });
});
