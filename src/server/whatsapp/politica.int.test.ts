import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { REGUA } from "@/server/cobrancas/regua";
import { MODOS_FABRICA } from "@/server/cobrancas/fabrica";
import { carregarPoliticaConfig } from "./consultas";
import { acionarKillSwitchRegua, salvarPoliticaRegua } from "./acoes";
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

async function seedNumero(driver: "META_CLOUD" | "BAILEYS") {
  return prisma.numeroWhatsApp.create({
    data: {
      telefoneE164: driver === "META_CLOUD" ? "+5511999990000" : "+5511988880000",
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

    const baileys = await seedNumero("BAILEYS");
    const travado = await salvarPoliticaRegua(inputFabrica({ estado: "SHADOW", numeroRemetenteId: baileys.id }));
    expect(travado.ok).toBe(false);
    expect((travado as { erro?: string }).erro).toContain("Trava do cron");
  });

  it("prontidão S15: número oficial exige template APROVADO nos degraus armados", async () => {
    const oficial = await seedNumero("META_CLOUD");
    const rascunho = await prisma.templateWhatsApp.create({
      data: { nome: "amigavel", corpo: "Olá {nome}!", statusMeta: "RASCUNHO" },
    });

    const input = inputFabrica({ estado: "SHADOW", numeroRemetenteId: oficial.id });
    input.degraus = input.degraus.map((d) => ({ ...d, templateId: rascunho.id }));
    const semAprovacao = await salvarPoliticaRegua(input);
    expect(semAprovacao.ok).toBe(false);
    expect((semAprovacao as { erro?: string }).erro).toContain("APROVADO");

    await prisma.templateWhatsApp.update({ where: { id: rascunho.id }, data: { statusMeta: "APROVADO" } });
    const armado = await salvarPoliticaRegua(input);
    expect(armado.ok, armado.ok ? "" : `falhou: ${(armado as { erro?: string }).erro}`).toBe(true);
    const politica = await prisma.politicaRegua.findFirstOrThrow();
    expect(politica.estado).toBe("SHADOW");
  });

  it("não-admin é negado", async () => {
    const financeiro = await criarUsuario([Papel.FINANCEIRO]);
    authMock.mockResolvedValue({ user: { id: financeiro.id } });
    const r = await salvarPoliticaRegua(inputFabrica());
    expect(r.ok).toBe(false);
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
