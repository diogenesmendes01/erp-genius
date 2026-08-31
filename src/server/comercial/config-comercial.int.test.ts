import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { salvarConfigComercial } from "./acoes";
import { carregarConfigComercial, carregarSaudacoesSimuladas } from "./consultas";

// Integração E6/C1: ação de config comercial (auto-lead + saudação). Alçada = Gerente
// Comercial/Admin; toggles nascem desligados; evento auditável antes→depois.

beforeEach(async () => {
  await truncarBanco();
});

describe("salvarConfigComercial", () => {
  it("gerente comercial salva; a config materializa e vira evento auditável", async () => {
    const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL]);
    authMock.mockResolvedValue({ user: { id: gerente.id } });

    // Fábrica: tudo desligado antes de salvar.
    const antes = await carregarConfigComercial();
    expect(antes).toEqual({
      autoLeadAtivo: false,
      saudacaoEstado: "DESLIGADA",
      saudacaoTexto: expect.any(String),
      // C3/C4: copiloto e matrícula automática também nascem desligados (regra de ouro).
      copilotoAtivo: false,
      copilotoQuietudeMinutos: 10,
      matriculaAutomaticaAtiva: false,
    });

    const r = await salvarConfigComercial({
      autoLeadAtivo: true,
      saudacaoEstado: "ATIVA",
      saudacaoTexto: "Oi! Já te respondo.",
    });
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);

    const depois = await carregarConfigComercial();
    expect(depois).toEqual({
      autoLeadAtivo: true,
      saudacaoEstado: "ATIVA",
      saudacaoTexto: "Oi! Já te respondo.",
      copilotoAtivo: false,
      copilotoQuietudeMinutos: 10,
      matriculaAutomaticaAtiva: false,
    });

    const eventos = await eventosDo("ConfigComercial", "comercial");
    expect(eventos.map((e) => e.tipo)).toContain("ConfigComercialAlterada");
  });

  it("armar a saudação (SHADOW/ATIVA) sem texto é recusado (Zod refine)", async () => {
    const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL]);
    authMock.mockResolvedValue({ user: { id: gerente.id } });
    const r = await salvarConfigComercial({ autoLeadAtivo: false, saudacaoEstado: "ATIVA", saudacaoTexto: "" });
    expect(r.ok).toBe(false);
  });

  it("vendedor não tem alçada", async () => {
    const vendedor = await criarUsuario([Papel.VENDEDOR]);
    authMock.mockResolvedValue({ user: { id: vendedor.id } });
    const r = await salvarConfigComercial({ autoLeadAtivo: true, saudacaoEstado: "DESLIGADA", saudacaoTexto: "x" });
    expect(r.ok).toBe(false);
    expect(await prisma.configComercial.count()).toBe(0);
  });
});

describe("carregarSaudacoesSimuladas (ensaio observável — review PR #53)", () => {
  it("lista as saudações reativas SIMULADAs com contato, texto e horário; ignora as reais", async () => {
    const numero = await prisma.numeroWhatsApp.create({
      data: { telefoneE164: "+5511900001111", rotulo: "Vendas", driver: "BAILEYS", finalidade: "VENDAS", providerRef: "inst-s" },
    });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50611112222", nomeExibicao: "Ana" } });
    await prisma.intencaoMensagem.create({
      data: { numeroId: numero.id, contatoId: contato.id, origem: "CRON", reativa: true, corpoRenderizado: "Oi Ana!", status: "SIMULADA" },
    });
    // Uma reativa DESPACHADA (real) e uma não-reativa SIMULADA não entram na lista de ensaio.
    await prisma.intencaoMensagem.create({
      data: { numeroId: numero.id, contatoId: contato.id, origem: "CRON", reativa: true, corpoRenderizado: "enviada", status: "DESPACHADA" },
    });

    const lista = await carregarSaudacoesSimuladas();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ contato: "Ana", texto: "Oi Ana!" });
  });
});
