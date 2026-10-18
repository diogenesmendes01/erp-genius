import { DriverWhatsApp } from "@prisma/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { seedCanal } from "@/test/integracao-whatsapp";
import { medirSaudeCanal } from "./saude";

const motor = vi.hoisted(() => ({ chamar: vi.fn() }));
vi.mock("./motor/cliente", () => ({ chamarMotor: motor.chamar }));

// Integração E5 (doc 30 · gap A7): a saúde do canal mede a fila POR ESTADO (review
// PR #52) — ADIADA esperando janela é saudável; o alerta é o que VENCEU sem ninguém pegar.

beforeEach(async () => {
  await truncarBanco();
  motor.chamar.mockReset();
  motor.chamar.mockResolvedValue({ eventos: [] });
});

async function seedContato(telefone = "+50611112222") {
  return prisma.contatoWhatsApp.create({ data: { telefoneE164: telefone } });
}

async function seedIntencao(
  over: Partial<Parameters<typeof prisma.intencaoMensagem.create>[0]["data"]> = {},
) {
  const { numero } = await seedCanal();
  const contato = await seedContato();
  return prisma.intencaoMensagem.create({
    data: {
      numeroId: numero.id,
      contatoId: contato.id,
      origem: "CRON",
      corpoRenderizado: "degrau",
      ...over,
    } as Parameters<typeof prisma.intencaoMensagem.create>[0]["data"],
  });
}

describe("medirSaudeCanal — fila por estado", () => {
  it("canal vazio e política de fábrica → saudável", async () => {
    const s = await medirSaudeCanal();
    expect(s.ok).toBe(true);
    expect(s.alertas).toEqual([]);
    expect(s.fila).toEqual({
      pendentes: 0,
      adiadas: 0,
      enviando: 0,
      pendenteHaMin: null,
      adiadaVencidaHaMin: null,
      claimExpiradoHaMin: null,
      falhas24h: 0,
      eventosMotorPendentes: 0,
      eventosMotorAdiados: 0,
      eventosMotorFalhos: null,
      retidasAgendaDesligada: 0,
      envioAgendaHabilitado: process.env.COMUNICACOES_AGENDA_ENVIO_ENABLED === "true",
    });
    expect(s.ultimoInboundEm).toBeNull();
  });

  it("PENDENTE parada além do limiar → alerta de cron parado", async () => {
    const agora = new Date();
    await seedIntencao({ criadaEm: new Date(agora.getTime() - 8 * 3600_000) });

    const s = await medirSaudeCanal(agora);
    expect(s.ok).toBe(false);
    expect(s.alertas.some((a) => a.includes("PENDENTE há"))).toBe(true);
    expect(s.fila.pendenteHaMin).toBeGreaterThanOrEqual(8 * 60);
  });

  it("mensagem AGENDADA para o futuro fica PENDENTE desde a criação e não alerta (C1 · R1 do #202)", async () => {
    const agora = new Date();
    await seedIntencao({
      origem: "HUMANO",
      criadaEm: new Date(agora.getTime() - 72 * 3600_000), // agendada há 3 dias...
      agendadaPara: new Date(agora.getTime() + 48 * 3600_000), // ...para daqui a 2 dias
    });

    const s = await medirSaudeCanal(agora);
    expect(s.ok).toBe(true);
    expect(s.fila.pendentes).toBe(1); // estoque da fila conta a agendada
    expect(s.fila.pendenteHaMin).toBeNull();
  });

  it("mensagem AGENDADA que venceu há horas e segue PENDENTE → alerta, medido desde o agendadaPara", async () => {
    const agora = new Date();
    await seedIntencao({
      origem: "HUMANO",
      criadaEm: new Date(agora.getTime() - 72 * 3600_000),
      agendadaPara: new Date(agora.getTime() - 5 * 3600_000),
    });

    const s = await medirSaudeCanal(agora);
    expect(s.ok).toBe(false);
    expect(s.alertas.some((a) => a.includes("PENDENTE há 5h"))).toBe(true);
  });

  it("ADIADA com despacho no FUTURO é saudável (noite/teto — não é incidente)", async () => {
    const agora = new Date();
    await seedIntencao({
      status: "ADIADA",
      motivoFalha: "fora_da_janela",
      despacharAposEm: new Date(agora.getTime() + 10 * 3600_000), // janela abre amanhã
    });

    const s = await medirSaudeCanal(agora);
    expect(s.ok).toBe(true);
    expect(s.fila.adiadas).toBe(1);
    expect(s.fila.adiadaVencidaHaMin).toBeLessThan(0); // ainda no futuro
  });

  it("ADIADA VENCIDA há horas sem redespachar → alerta", async () => {
    const agora = new Date();
    await seedIntencao({
      status: "ADIADA",
      motivoFalha: "fora_da_janela",
      despacharAposEm: new Date(agora.getTime() - 3 * 3600_000), // venceu há 3h
    });

    const s = await medirSaudeCanal(agora);
    expect(s.ok).toBe(false);
    expect(s.alertas.some((a) => a.includes("ADIADA venceu"))).toBe(true);
  });

  it("claim ENVIANDO expirado sem recuperação → alerta (cron nem recuperou o órfão)", async () => {
    const agora = new Date();
    await seedIntencao({
      status: "ENVIANDO",
      despacharAposEm: new Date(agora.getTime() - 45 * 60_000), // claim venceu há 45min
    });

    const s = await medirSaudeCanal(agora);
    expect(s.ok).toBe(false);
    expect(s.alertas.some((a) => a.includes("claim expirado"))).toBe(true);
    expect(s.fila.claimExpiradoHaMin).toBeGreaterThanOrEqual(45);
  });

  it("kill switch LIGADO: PENDENTE parada é esperada — só o alerta do kill switch dispara", async () => {
    const agora = new Date();
    await seedIntencao({ criadaEm: new Date(agora.getTime() - 8 * 3600_000) });
    await prisma.politicaRegua.updateMany({ data: { killSwitch: true } });

    const s = await medirSaudeCanal(agora);
    expect(s.ok).toBe(false);
    expect(s.alertas).toHaveLength(1);
    expect(s.alertas[0]).toContain("Kill switch");
  });

  it("sessão caída de driver legado não gera alerta: só o motor tem sessão", async () => {
    await prisma.numeroWhatsApp.create({
      data: { telefoneE164: "+5511911110000", rotulo: "Vendas", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", sessao: "CAIU" },
    });

    const s = await medirSaudeCanal();
    expect(s.alertas.filter((a) => a.includes("caiu"))).toHaveLength(0);
  });

  it("falhas24h conta pela TRANSIÇÃO para FALHOU (atualizadoEm), não pela criação", async () => {
    const agora = new Date();
    // Intenção CRIADA há 3 dias que falhou AGORA: precisa contar.
    const velha = await seedIntencao({ criadaEm: new Date(agora.getTime() - 72 * 3600_000) });
    await prisma.intencaoMensagem.update({
      where: { id: velha.id },
      data: { status: "FALHOU", motivoFalha: "meta_api" }, // @updatedAt marca a transição
    });

    const s = await medirSaudeCanal(agora);
    expect(s.fila.falhas24h).toBe(1);
    expect(s.alertas.some((a) => a.includes("falharam"))).toBe(true);

    // Falha ANTIGA (transição há 2 dias) não conta: envelhece o atualizadoEm por SQL cru
    // (o client sobrescreveria o @updatedAt).
    await prisma.$executeRaw`UPDATE "IntencaoMensagem" SET "atualizadoEm" = ${new Date(
      agora.getTime() - 48 * 3600_000,
    )} WHERE "id" = ${velha.id}`;
    const depois = await medirSaudeCanal(agora);
    expect(depois.fila.falhas24h).toBe(0);
  });

  it("último inbound aparece (webhook vivo)", async () => {
    const { numero } = await seedCanal();
    const contato = await seedContato();
    const conversa = await prisma.conversaWhatsApp.create({
      data: { numeroId: numero.id, contatoId: contato.id },
    });
    await prisma.mensagemWhatsApp.create({
      data: {
        conversaId: conversa.id,
        numeroId: numero.id,
        direcao: "ENTRADA",
        corpo: "oi",
        driver: DriverWhatsApp.META_CLOUD,
        providerMessageId: "MSG-SAUDE-1",
      },
    });

    const s = await medirSaudeCanal();
    expect(s.ultimoInboundEm).not.toBeNull();
  });
});

describe("medirSaudeCanal — motor", () => {
  it("saúde alerta sessão MOTOR caída e eventos falhos no motor", async () => {
    const { numero } = await seedCanal();
    await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { driver: "MOTOR", sessao: "CAIU" } });
    motor.chamar.mockResolvedValue({ eventos: [{ idEvento: "e1" }] });
    const s = await medirSaudeCanal();
    expect(s.ok).toBe(false);
    expect(s.alertas.some((a) => a.includes("Sessão do número") && a.includes("caiu"))).toBe(true);
    expect(s.alertas.some((a) => a.includes("1 evento(s) falharam no motor"))).toBe(true);
    expect(s.fila.eventosMotorFalhos).toBe(1);
  });

  it("evento do motor parado há mais de 15 min alerta; recente só conta como pendente", async () => {
    const agora = new Date();
    const base = { tipo: "mensagem.recebida", numeroRef: "n", ocorridoEm: agora, dados: {} };
    await prisma.eventoMotorRecebido.create({
      data: { ...base, idEvento: "11111111-1111-4111-8111-111111111111", recebidoEm: new Date(agora.getTime() - 20 * 60_000) },
    });
    const s = await medirSaudeCanal(agora);
    expect(s.fila.eventosMotorPendentes).toBe(1);
    expect(s.alertas.some((a) => a.includes("Evento do motor parado"))).toBe(true);

    await prisma.eventoMotorRecebido.updateMany({ data: { recebidoEm: new Date(agora.getTime() - 60_000) } });
    const s2 = await medirSaudeCanal(agora);
    expect(s2.fila.eventosMotorPendentes).toBe(1);
    expect(s2.alertas.some((a) => a.includes("Evento do motor parado"))).toBe(false);
  });

  it("evento em backoff (tentativas > 0, próxima tentativa no futuro) conta como adiado e não alerta", async () => {
    const agora = new Date();
    await prisma.eventoMotorRecebido.create({
      data: {
        idEvento: "22222222-2222-4222-8222-222222222222",
        tipo: "mensagem.status",
        numeroRef: "n",
        ocorridoEm: agora,
        dados: {},
        recebidoEm: new Date(agora.getTime() - 40 * 60_000),
        tentativas: 8,
        proximaTentativaEm: new Date(agora.getTime() + 10 * 60_000),
        resultado: "adiado:status_sem_mensagem",
      },
    });
    const s = await medirSaudeCanal(agora);
    expect(s.fila.eventosMotorAdiados).toBe(1);
    expect(s.fila.eventosMotorPendentes).toBe(0);
    expect(s.alertas.some((a) => a.includes("Evento do motor parado"))).toBe(false);
    expect(s.ok).toBe(true);
  });

  it("evento cuja próxima tentativa venceu há mais de 15 min alerta (o dreno não o pegou)", async () => {
    const agora = new Date();
    await prisma.eventoMotorRecebido.create({
      data: {
        idEvento: "33333333-3333-4333-8333-333333333333",
        tipo: "mensagem.status",
        numeroRef: "n",
        ocorridoEm: agora,
        dados: {},
        recebidoEm: new Date(agora.getTime() - 60 * 60_000),
        tentativas: 3,
        proximaTentativaEm: new Date(agora.getTime() - 20 * 60_000),
      },
    });
    const s = await medirSaudeCanal(agora);
    expect(s.fila.eventosMotorAdiados).toBe(0);
    expect(s.fila.eventosMotorPendentes).toBe(1);
    expect(s.alertas.some((a) => a.includes("Evento do motor parado há 20min"))).toBe(true);

    // Vencida há pouco (dentro do limiar) ainda não alerta, mesmo recebida há 1 h.
    await prisma.eventoMotorRecebido.updateMany({ data: { proximaTentativaEm: new Date(agora.getTime() - 60_000) } });
    const s2 = await medirSaudeCanal(agora);
    expect(s2.alertas.some((a) => a.includes("Evento do motor parado"))).toBe(false);
  });

  it("motor inalcançável com número MOTOR ativo → eventosMotorFalhos null e alerta", async () => {
    const { numero } = await seedCanal();
    await prisma.numeroWhatsApp.update({ where: { id: numero.id }, data: { driver: "MOTOR", sessao: "CONECTADO" } });
    motor.chamar.mockRejectedValue(new Error("motor_indisponivel"));
    const s = await medirSaudeCanal();
    expect(s.fila.eventosMotorFalhos).toBeNull();
    expect(s.ok).toBe(false);
    expect(s.alertas.some((a) => a.includes("Motor WhatsApp inalcançável") && a.includes("motor_indisponivel"))).toBe(true);
  });

  it("sem número MOTOR ativo o motor nem é consultado e não há alerta de inalcançável", async () => {
    await seedCanal({ driver: DriverWhatsApp.BAILEYS });
    motor.chamar.mockRejectedValue(new Error("motor_indisponivel"));
    const s = await medirSaudeCanal();
    expect(motor.chamar).not.toHaveBeenCalled();
    expect(s.alertas.some((a) => a.includes("inalcançável"))).toBe(false);
  });
});

// C1 do #212: o motivo `envio_agenda_desligado` fica gravado até o próximo tick pegar a intenção.
// Religado o envio de agenda, a saúde não pode seguir mostrando avisos retidos por ele.
describe("medirSaudeCanal — retidas pelo envio de agenda desligado", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("com o envio desligado, conta a intenção retida pelo motivo próprio", async () => {
    vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "false");
    await seedIntencao({ motivoFalha: "envio_agenda_desligado" });

    const s = await medirSaudeCanal();
    expect(s.fila.envioAgendaHabilitado).toBe(false);
    expect(s.fila.retidasAgendaDesligada).toBe(1);
  });

  it("religado o envio, o motivo antigo ainda gravado não conta como retido", async () => {
    vi.stubEnv("COMUNICACOES_AGENDA_ENVIO_ENABLED", "true");
    await seedIntencao({ motivoFalha: "envio_agenda_desligado" });

    const s = await medirSaudeCanal();
    expect(s.fila.envioAgendaHabilitado).toBe(true);
    expect(s.fila.retidasAgendaDesligada).toBe(0);
    expect(s.fila.pendentes).toBe(1);
  });
});
