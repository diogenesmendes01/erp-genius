import { DriverWhatsApp } from "@prisma/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Papel } from "@prisma/client";

// Driver do motor FALSO: nenhuma mensagem real pode sair.
const { enviarTexto, enviarTemplate, enviarMidia } = vi.hoisted(() => ({
  enviarTexto: vi.fn(),
  enviarTemplate: vi.fn(),
  enviarMidia: vi.fn(),
}));
vi.mock("./drivers/motor", () => ({ driverMotor: { enviarTexto, enviarTemplate, enviarMidia } }));
// A revalidação do aviso de agenda (config, template, fonte) é coberta em agenda/*; aqui só
// interessa o comportamento do catch pós-claim, então ela é neutralizada (claim e resultado reais).
vi.mock("@/server/comunicacoes-agenda/whatsapp", async (orig) => ({
  ...(await orig<typeof import("@/server/comunicacoes-agenda/whatsapp")>()),
  motivoAvisoAgendaInvalido: async () => null,
}));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { despacharFila } from "./despachante";
import { garantirAtendimento } from "./atendimentos";
import { ErroDriver } from "./canal";

beforeEach(async () => {
  await truncarBanco();
  vi.stubEnv("WHATSAPP_LIVE", "1");
  for (const m of [enviarTexto, enviarTemplate, enviarMidia]) m.mockReset();
  enviarTexto.mockResolvedValue({ providerMessageId: "3EB0X", mensagemIdMotor: "c:3EB0X" });
  enviarTemplate.mockResolvedValue({ providerMessageId: "3EB0T", mensagemIdMotor: "c:3EB0T" });
});
afterEach(() => vi.unstubAllEnvs());

async function seed(over: Parameters<typeof seedCanal>[0] = {}, extra: Record<string, unknown> = {}) {
  const { numero, templates } = await seedCanal(over);
  const autor = await criarUsuario([Papel.ADMINISTRADOR]);
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887777" } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, {
    numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: autor.id,
  }));
  const intencao = await prisma.intencaoMensagem.create({
    data: {
      numeroId: numero.id, contatoId: contato.id, atendimentoId: at.id,
      origem: "HUMANO", autorId: autor.id, corpoRenderizado: "oi", ...extra,
    },
  });
  return { numero, templates, intencaoId: intencao.id };
}

describe("despachante × motor", () => {
  it("claim grava clientMessageId UUID e o driver recebe o mesmo id", async () => {
    const { intencaoId } = await seed();
    await despacharFila(new Date(), { intencaoId });
    const i = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencaoId }, include: { mensagem: true } });
    expect(i.status).toBe("DESPACHADA");
    expect(i.clientMessageId).toMatch(/^[0-9a-f-]{36}$/);
    expect(enviarTexto).toHaveBeenCalledWith(expect.anything(), "+50688887777", "oi",
      expect.objectContaining({ clientMessageId: i.clientMessageId, origem: "HUMANO" }));
    expect(i.mensagem).toMatchObject({ driver: "MOTOR", clientMessageId: i.clientMessageId, providerMessageId: "3EB0X", mensagemIdMotor: "c:3EB0X" });
  });

  it("segunda tentativa reaproveita o clientMessageId já gravado", async () => {
    const { intencaoId } = await seed({}, { clientMessageId: "11111111-1111-4111-8111-111111111111" });
    await despacharFila(new Date(), { intencaoId });
    expect(enviarTexto).toHaveBeenCalledWith(expect.anything(), "+50688887777", "oi",
      expect.objectContaining({ clientMessageId: "11111111-1111-4111-8111-111111111111" }));
    const i = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencaoId } });
    expect(i.clientMessageId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("intenção com template em MOTOR chama enviarTemplate (texto renderizado), sem exigir statusMeta", async () => {
    const { numero, templates } = await seedCanal();
    const t = await prisma.templateWhatsApp.create({ data: { nome: "livre", corpo: "olá {{1}}", statusMeta: "RASCUNHO" } });
    void templates;
    const autor = await criarUsuario([Papel.ADMINISTRADOR]);
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887777" } });
    const at = await prisma.$transaction((tx) => garantirAtendimento(tx, {
      numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: autor.id,
    }));
    const i = await prisma.intencaoMensagem.create({
      data: { numeroId: numero.id, contatoId: contato.id, atendimentoId: at.id, origem: "HUMANO", autorId: autor.id,
        corpoRenderizado: "olá Ana", templateId: t.id, variaveis: ["Ana"] },
    });
    await despacharFila(new Date(), { intencaoId: i.id });
    expect(enviarTemplate).toHaveBeenCalledWith(expect.anything(), "+50688887777",
      expect.objectContaining({ nome: "livre", corpoRenderizado: "olá Ana" }), expect.anything());
    expect(enviarTexto).not.toHaveBeenCalled();
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).status).toBe("DESPACHADA");
  });

  it("número BAILEYS legado → FALHOU driver_indisponivel sem I/O", async () => {
    const { intencaoId } = await seed({ driver: DriverWhatsApp.BAILEYS });
    const r = await despacharFila(new Date(), { intencaoId });
    expect(r.falhas).toBe(1);
    const i = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencaoId } });
    expect(i).toMatchObject({ status: "FALHOU", motivoFalha: "driver_indisponivel" });
    expect(enviarTexto).not.toHaveBeenCalled();
    expect(enviarTemplate).not.toHaveBeenCalled();
  });

  it("intenção CRON em número MOTOR não é cancelada por trava_driver_oficial (S1 revogada, D38)", async () => {
    const { intencaoId } = await seed({}, { origem: "CRON" });
    await despacharFila(new Date(), { intencaoId });
    const i = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencaoId } });
    expect(i.motivoFalha).not.toBe("trava_driver_oficial");
    expect(i.status).not.toBe("CANCELADA");
  });

  it("intenção CRON em número BAILEYS segue cancelada por trava_driver_oficial", async () => {
    const { intencaoId } = await seed({ driver: DriverWhatsApp.BAILEYS }, { origem: "CRON" });
    const r = await despacharFila(new Date(), { intencaoId });
    expect(r.canceladas).toBe(1);
    const i = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencaoId } });
    expect(i).toMatchObject({ status: "CANCELADA", motivoFalha: "trava_driver_oficial" });
    expect(enviarTexto).not.toHaveBeenCalled();
  });

  describe("falha reprocessável", () => {
    const agora = new Date("2026-10-17T15:00:00.000Z");
    const intencao = (id: string) => prisma.intencaoMensagem.findUniqueOrThrow({ where: { id } });
    const falhaMotor = () => new ErroDriver("motor_indisponivel", undefined, { reprocessavel: true, adiarMs: 60000 });

    it("ECONNREFUSED adia 60 s com o mesmo clientMessageId", async () => {
      const { intencaoId } = await seed({}, { criadaEm: agora });
      enviarTexto.mockRejectedValue(falhaMotor());
      const r = await despacharFila(agora, { intencaoId });
      expect(r).toMatchObject({ adiadas: 1, falhas: 0 });
      expect(await intencao(intencaoId)).toMatchObject({ status: "ADIADA", motivoFalha: "motor_indisponivel", despacharAposEm: new Date(agora.getTime() + 60000) });
      enviarTexto.mockResolvedValue({ providerMessageId: "3EB0X", mensagemIdMotor: "c:3EB0X" });
      await despacharFila(new Date(agora.getTime() + 61000), { intencaoId });
      expect(enviarTexto).toHaveBeenCalledTimes(2);
      expect(enviarTexto.mock.calls[0][3].clientMessageId).toBe(enviarTexto.mock.calls[1][3].clientMessageId);
      expect((await intencao(intencaoId)).status).toBe("DESPACHADA");
    });

    it("HUMANO com 31 min de vida falha em vez de adiar", async () => {
      const { intencaoId } = await seed({}, { criadaEm: new Date(agora.getTime() - 31 * 60_000) });
      enviarTexto.mockRejectedValue(falhaMotor());
      const r = await despacharFila(agora, { intencaoId });
      expect(r).toMatchObject({ adiadas: 0, falhas: 1 });
      expect(await intencao(intencaoId)).toMatchObject({ status: "FALHOU", motivoFalha: "motor_indisponivel" });
    });

    it("HUMANO com 29 min de vida ainda adia", async () => {
      const { intencaoId } = await seed({}, { criadaEm: new Date(agora.getTime() - 29 * 60_000) });
      enviarTexto.mockRejectedValue(falhaMotor());
      await despacharFila(agora, { intencaoId });
      expect((await intencao(intencaoId)).status).toBe("ADIADA");
    });

    it("aviso de agenda não adia: segue o fluxo FALHOU atual", async () => {
      vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "true");
      const { intencaoId } = await seed({}, { criadaEm: agora });
      const { pais, produto } = await seedCatalogoMinimo();
      const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno aviso", paisId: pais.id } });
      const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: produto.id, paisId: pais.id, moeda: "CRC", status: "ATIVA" } });
      const evento = await prisma.evento.create({ data: {
        tipo: "RemarcacaoParticularDecidida", agregadoTipo: "Matricula", agregadoId: matricula.id, payload: { aprovada: true },
      } });
      const aviso = await prisma.avisoAlteracaoAgenda.create({
        data: { mudancaId: evento.id, eventoId: evento.id, matriculaId: matricula.id, alunoId: aluno.id, canal: "WHATSAPP", destinatarioAlunoId: aluno.id, contatoHash: "h", chave: "chave-aviso-nao-adia" },
      });
      await prisma.intencaoMensagem.update({ where: { id: intencaoId }, data: { avisoAlteracaoAgendaId: aviso.id } });
      enviarTexto.mockRejectedValue(falhaMotor());
      const r = await despacharFila(agora, { intencaoId });
      expect(r).toMatchObject({ adiadas: 0, falhas: 1 });
      expect(await intencao(intencaoId)).toMatchObject({ status: "FALHOU", motivoFalha: "motor_indisponivel" });
    });

    // B1 da R1 do #213: a retenção de agenda da #209/#212 vale também com o envio pelo motor.
    it("aviso de agenda com o envio de agenda desligado fica retido: não vai ao motor nem vira SIMULADA", async () => {
      vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "false");
      const { intencaoId } = await seed({}, { criadaEm: agora });
      const { pais, produto } = await seedCatalogoMinimo();
      const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno aviso", paisId: pais.id } });
      const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: produto.id, paisId: pais.id, moeda: "CRC", status: "ATIVA" } });
      const evento = await prisma.evento.create({ data: {
        tipo: "RemarcacaoParticularDecidida", agregadoTipo: "Matricula", agregadoId: matricula.id, payload: { aprovada: true },
      } });
      const aviso = await prisma.avisoAlteracaoAgenda.create({
        data: { mudancaId: evento.id, eventoId: evento.id, matriculaId: matricula.id, alunoId: aluno.id, canal: "WHATSAPP", destinatarioAlunoId: aluno.id, contatoHash: "h", chave: "chave-aviso-retido" },
      });
      await prisma.intencaoMensagem.update({ where: { id: intencaoId }, data: { avisoAlteracaoAgendaId: aviso.id } });
      const r = await despacharFila(agora, { intencaoId });
      expect(r).toMatchObject({ retidasAgenda: 1, despachadas: 0, simuladas: 0, falhas: 0 });
      expect(enviarTexto).not.toHaveBeenCalled();
      expect(await intencao(intencaoId)).toMatchObject({ status: "PENDENTE", motivoFalha: "envio_agenda_desligado", clientMessageId: null });
    });

    it("resultado_incerto continua FALHOU (revisão humana)", async () => {
      const { intencaoId } = await seed({}, { criadaEm: agora });
      enviarTexto.mockRejectedValue(new ErroDriver("resultado_incerto"));
      const r = await despacharFila(agora, { intencaoId });
      expect(r).toMatchObject({ adiadas: 0, falhas: 1 });
      expect(await intencao(intencaoId)).toMatchObject({ status: "FALHOU", motivoFalha: "resultado_incerto" });
    });
  });
});
