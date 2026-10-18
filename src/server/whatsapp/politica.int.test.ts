import { describe, it, expect, beforeEach, vi } from "vitest";
import { DriverWhatsApp, Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { REGUA } from "@/server/cobrancas/regua";
import { MODOS_FABRICA } from "@/server/cobrancas/fabrica";
import { carregarPoliticaConfig } from "./consultas";
import { acionarKillSwitchRegua, salvarConfiguracaoAvisosAgenda, salvarPoliticaRegua } from "./acoes";
import type { PoliticaReguaInput } from "./schema";

// Integração E4 (doc 30): política como dado — salvar/armar com as LEIS (D+15 manual,
// trava S1) e a prontidão S15 (número oficial exige template aprovado nos degraus armados).

let admin: Awaited<ReturnType<typeof criarUsuario>>;

beforeEach(async () => {
  await truncarBanco();
  admin = await criarUsuario([Papel.ADMINISTRADOR]);
  authMock.mockResolvedValue({ user: { id: admin.id } });
});

function inputFabrica(over: Partial<PoliticaReguaInput> = {}): PoliticaReguaInput {
  return {
    estado: "DESLIGADA",
    janelaInicio: 9,
    janelaFim: 20,
    diasSemana: [1, 2, 3, 4, 5],
    tetoPorContatoDia: 2,
    silencioPosInboundHoras: 72,
    killSwitch: false,
    degraus: REGUA.map((d) => ({
      passo: d.passo,
      offsetDias: d.offsetDias,
      modo: MODOS_FABRICA[d.passo],
      ativo: true,
    })),
    ...over,
  };
}

async function seedNumero(driver: DriverWhatsApp) {
  return prisma.numeroWhatsApp.create({
    data: {
      telefoneE164: driver === DriverWhatsApp.META_CLOUD ? "+5511999990000" : driver === DriverWhatsApp.MOTOR ? "+5511977770000" : "+5511988880000",
      rotulo: `Teste ${driver}`,
      driver,
      finalidade: "COBRANCA",
      providerRef: "ref-teste",
    },
  });
}

describe("salvarPoliticaRegua", () => {
  it("DESLIGADA salva livre: materializa o registro + degraus + evento antes→depois", async () => {
    const r = await salvarPoliticaRegua(inputFabrica());
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);

    const politica = await prisma.politicaRegua.findFirstOrThrow({ include: { degraus: true } });
    expect(politica.degraus).toHaveLength(6);
    const eventos = await eventosDo("PoliticaRegua", politica.id);
    expect(eventos.map((e) => e.tipo)).toContain("PoliticaReguaAlterada");
    const payload = eventos[0].payload as { antes: unknown };
    expect(payload.antes).toBeNull(); // primeira materialização
  });

  it("LEI: D+15 (bloquear) vira MANUAL mesmo que a UI mande AUTOMATICO", async () => {
    const input = inputFabrica();
    input.degraus = input.degraus.map((d) => (d.passo === "D+15" ? { ...d, modo: "AUTOMATICO" as const } : d));
    const r = await salvarPoliticaRegua(input);
    expect(r.ok).toBe(true);

    const d15 = await prisma.degrauPolitica.findFirstOrThrow({ where: { passo: "D+15" } });
    expect(d15.modo).toBe("MANUAL");
  });

  it("armar sem remetente → erro; trava S1: remetente Baileys + degrau automático → erro", async () => {
    const semRemetente = await salvarPoliticaRegua(inputFabrica({ estado: "SHADOW" }));
    expect(semRemetente.ok).toBe(false);
    expect((semRemetente as { erro?: string }).erro).toContain("remetente");

    const baileys = await seedNumero(DriverWhatsApp.BAILEYS);
    const travado = await salvarPoliticaRegua(inputFabrica({ estado: "SHADOW", numeroRemetenteId: baileys.id }));
    expect(travado.ok).toBe(false);
    expect((travado as { erro?: string }).erro).toContain("Trava do cron");
  });

  it("salvarPoliticaRegua arma degrau AUTOMATICO com remetente MOTOR (D38), sem exigir template aprovado", async () => {
    const motor = await seedNumero("MOTOR");
    const r = await salvarPoliticaRegua(inputFabrica({ estado: "SHADOW", numeroRemetenteId: motor.id }));
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);
    expect((await prisma.politicaRegua.findFirstOrThrow()).estado).toBe("SHADOW");
  });

  it("META_CLOUD não arma a política: Meta Cloud ainda não tem envio disponível (C1 da R1 do #213)", async () => {
    const oficial = await seedNumero(DriverWhatsApp.META_CLOUD);
    const aprovado = await prisma.templateWhatsApp.create({
      data: { nome: "amigavel", corpo: "Olá {nome}!", statusMeta: "APROVADO" },
    });
    const input = inputFabrica({ estado: "SHADOW", numeroRemetenteId: oficial.id });
    input.degraus = input.degraus.map((d) => ({ ...d, templateId: aprovado.id, modo: d.modo === "AUTOMATICO" ? "MANUAL" as const : d.modo }));
    const recusado = await salvarPoliticaRegua(input);
    expect(recusado.ok).toBe(false);
    expect((recusado as { erro?: string }).erro).toContain("Meta Cloud ainda não tem envio disponível");
    expect(await prisma.politicaRegua.count()).toBe(0);

    // Desligada continua salvando livre (nada é armado).
    const desligada = await salvarPoliticaRegua(inputFabrica({ numeroRemetenteId: oficial.id }));
    expect(desligada.ok).toBe(true);
  });

  it("não-admin é negado", async () => {
    const financeiro = await criarUsuario([Papel.FINANCEIRO]);
    authMock.mockResolvedValue({ user: { id: financeiro.id } });
    const r = await salvarPoliticaRegua(inputFabrica());
    expect(r.ok).toBe(false);
  });
});

describe("salvarConfiguracaoAvisosAgenda", () => {
  async function seedAgenda(driver: DriverWhatsApp) {
    const numero = await prisma.numeroWhatsApp.create({
      data: { telefoneE164: driver === "MOTOR" ? "+50675550001" : "+50675550002", rotulo: `Agenda ${driver}`, driver, finalidade: "AGENDA", providerRef: "ref-agenda" },
    });
    const template = await prisma.templateWhatsApp.create({
      data: { nome: `agenda_${driver.toLowerCase()}`, corpo: "Olá {nome}. Horários: {horarios}", idioma: "es", categoria: "utility", statusMeta: "APROVADO", metaTemplateId: "waba-agenda" },
    });
    return { numero, template };
  }

  it("driver legado é recusado: só o motor envia aviso de agenda", async () => {
    const { numero, template } = await seedAgenda(DriverWhatsApp.META_CLOUD);
    const r = await salvarConfiguracaoAvisosAgenda({ numeroAvisosAgendaId: numero.id, templateAvisosAgendaId: template.id });
    expect(r.ok).toBe(false);
    expect((r as { erro?: string }).erro).toContain("número de agenda ativo do motor WhatsApp");
    expect(await prisma.configuracaoOperacional.count()).toBe(0);
  });

  it("MOTOR é aceito", async () => {
    const { numero, template } = await seedAgenda("MOTOR");
    const r = await salvarConfiguracaoAvisosAgenda({ numeroAvisosAgendaId: numero.id, templateAvisosAgendaId: template.id });
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);
    expect(await prisma.configuracaoOperacional.findUniqueOrThrow({ where: { id: "escola" } })).toMatchObject({ numeroAvisosAgendaId: numero.id });
  });
});

describe("acionarKillSwitchRegua", () => {
  it("liga/desliga com evento; sem política salva ainda → erro claro", async () => {
    const semPolitica = await acionarKillSwitchRegua(true);
    expect(semPolitica.ok).toBe(false);

    await salvarPoliticaRegua(inputFabrica());
    const ligado = await acionarKillSwitchRegua(true);
    expect(ligado.ok).toBe(true);

    const politica = await prisma.politicaRegua.findFirstOrThrow();
    expect(politica.killSwitch).toBe(true);
    const eventos = await eventosDo("PoliticaRegua", politica.id);
    expect(eventos.filter((e) => e.tipo === "PoliticaReguaAlterada").length).toBeGreaterThanOrEqual(2);
  });
});

describe("carregarPoliticaConfig", () => {
  it("sem registro devolve a fábrica (id null); com registro devolve o dado salvo", async () => {
    const fabrica = await carregarPoliticaConfig();
    expect(fabrica.id).toBeNull();
    expect(fabrica.degraus).toHaveLength(6);

    await salvarPoliticaRegua(inputFabrica({ tetoPorContatoDia: 3 }));
    const salva = await carregarPoliticaConfig();
    expect(salva.id).not.toBeNull();
    expect(salva.tetoPorContatoDia).toBe(3);
  });
});
