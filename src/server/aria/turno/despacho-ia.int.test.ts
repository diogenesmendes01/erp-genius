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
import { aoGravarSaidaHumana } from "../pausa";
import type { ProvedorIA, RespostaIA } from "../provedor/tipos";
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
  async gerar(): Promise<RespostaIA> {
    return {
      texto: JSON.stringify({ resposta: "Temos turmas à noite, quer conhecer?", documentoId: null, acoes: [], confianca: 95, handoff: null, fontes: [], humor: null }),
      modelo: "simulado", provedor: "simulado", recusa: false, tokensEntrada: 0, tokensSaida: 0, tokensCache: 0, latenciaMs: 0,
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

// Revisão final do bloco 5C (achado 3): fala da Aria ainda não enviada não sai depois que uma pessoa
// assume; o aviso do próprio handoff sai.
describe("falas pendentes da Aria e a pausa no atendimento", () => {
  const amanha = () => new Date(Date.now() + 24 * 3600_000);
  const comAgendamento: ProvedorIA = {
    nome: "simulado",
    async gerar(p): Promise<RespostaIA> {
      const fala = [...p.mensagens].reverse().find((m) => m.papel === "usuario")?.texto.toLowerCase() ?? "";
      const humano = fala.includes("humano");
      return {
        texto: JSON.stringify({
          resposta: humano ? "Certo, vou chamar alguém." : "Combinado, te lembro amanhã.",
          documentoId: null,
          acoes: humano ? [] : [{ acao: "AGENDAR_MENSAGEM", texto: "Oi! Passando para lembrar da aula experimental.", enviarEmISO: amanha().toISOString(), justificativa: "lembrete" }],
          confianca: humano ? 20 : 95,
          handoff: humano ? { motivo: "PEDIDO_HUMANO" } : null,
          fontes: [],
          humor: null,
        }),
        modelo: "simulado", provedor: "simulado", recusa: false, tokensEntrada: 0, tokensSaida: 0, tokensCache: 0, latenciaMs: 0,
      };
    },
  };
  async function cenarioAgendar() {
    const c = await cenario("ATIVA");
    const cfg = configPadrao();
    cfg.matriz = { ...cfg.matriz, NOVO: { ...(cfg.matriz.NOVO ?? {}), RESPONDER: "EXECUTA", AGENDAR_MENSAGEM: "EXECUTA" } };
    await prisma.versaoAgenteIA.updateMany({ data: { config: cfg } });
    return c;
  }

  it("humano_responde_e_cancela_resposta_na_fila_e_mensagem_agendada_da_aria", async () => {
    const c = await cenarioAgendar();
    const m = await c.inbound("Pode me lembrar da aula amanhã?");
    expect(await processarTurnoAria(m.id, { provedor: comAgendamento })).toMatchObject({ resultado: "RESPONDEU" });
    expect(await prisma.intencaoMensagem.count({ where: { origem: "IA", status: "PENDENTE" } })).toBe(2);

    await prisma.$transaction((tx) => aoGravarSaidaHumana(tx, { atendimentoId: c.at.id, origem: "HUMANO", autorId: null }));
    const ias = await prisma.intencaoMensagem.findMany({ where: { origem: "IA" } });
    expect(ias.map((i) => [i.status, i.motivoFalha])).toEqual([
      ["CANCELADA", "aria_pausada_no_atendimento"],
      ["CANCELADA", "aria_pausada_no_atendimento"],
    ]);
    expect(await prisma.evento.count({ where: { tipo: "FalasDaAriaCanceladas", agregadoId: c.at.id } })).toBe(1);
    await despacharFila(new Date(amanha().getTime() + 3600_000));
    expect(enviarTextoMock).not.toHaveBeenCalled();
  });

  it("despachante_recusa_fala_da_aria_com_atendimento_pausado_por_humano", async () => {
    const c = await cenarioAgendar();
    const m = await c.inbound("Quero saber das turmas de inglês");
    await processarTurnoAria(m.id, { provedor });
    // Pausa gravada sem passar pelo cancelamento (por exemplo, a intenção já estava sendo reivindicada).
    await prisma.atendimentoWhatsApp.update({ where: { id: c.at.id }, data: { iaPausadaEm: new Date(), iaPausaMotivo: "CELULAR" } });
    expect(await despacharFila()).toMatchObject({ despachadas: 0, canceladas: 1 });
    expect(enviarTextoMock).not.toHaveBeenCalled();
    expect(await prisma.intencaoMensagem.findFirstOrThrow()).toMatchObject({ status: "CANCELADA", motivoFalha: "aria_pausada_no_atendimento" });
  });

  it("aviso_de_handoff_sai_e_mensagem_agendada_antes_do_handoff_nao", async () => {
    const c = await cenarioAgendar();
    const m1 = await c.inbound("Pode me lembrar da aula amanhã?");
    expect(await processarTurnoAria(m1.id, { provedor: comAgendamento })).toMatchObject({ resultado: "RESPONDEU" });
    expect(await despacharFila()).toMatchObject({ despachadas: 1 });

    const m2 = await c.inbound("quero falar com um humano");
    expect(await processarTurnoAria(m2.id, { provedor: comAgendamento })).toMatchObject({ resultado: "HANDOFF" });
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: c.at.id } })).iaPausaMotivo).toBe("HANDOFF");
    // O aviso do handoff sai mesmo com a Aria já pausada pelo próprio handoff.
    expect(await despacharFila()).toMatchObject({ despachadas: 1, canceladas: 0 });
    expect(enviarTextoMock).toHaveBeenCalledTimes(2);

    // A mensagem agendada antes do handoff não sai quando chega a hora.
    await despacharFila(new Date(amanha().getTime() + 3600_000));
    expect(enviarTextoMock).toHaveBeenCalledTimes(2);
    const agendada = await prisma.intencaoMensagem.findFirstOrThrow({ where: { agendadaPara: { not: null } } });
    expect(agendada).toMatchObject({ status: "CANCELADA", motivoFalha: "aria_pausada_no_atendimento" });
  });
});
