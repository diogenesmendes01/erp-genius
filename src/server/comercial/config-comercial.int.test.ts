import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import { salvarConfigComercial } from "./acoes";
import { carregarConfigComercial } from "./consultas";

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
    expect(antes).toEqual({ autoLeadAtivo: false, saudacaoAtiva: false, saudacaoTexto: expect.any(String) });

    const r = await salvarConfigComercial({
      autoLeadAtivo: true,
      saudacaoAtiva: true,
      saudacaoTexto: "Oi! Já te respondo.",
    });
    expect(r.ok, r.ok ? "" : `falhou: ${(r as { erro?: string }).erro}`).toBe(true);

    const depois = await carregarConfigComercial();
    expect(depois).toEqual({ autoLeadAtivo: true, saudacaoAtiva: true, saudacaoTexto: "Oi! Já te respondo." });

    const eventos = await eventosDo("ConfigComercial", "comercial");
    expect(eventos.map((e) => e.tipo)).toContain("ConfigComercialAlterada");
  });

  it("ativar a saudação sem texto é recusado (Zod refine)", async () => {
    const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL]);
    authMock.mockResolvedValue({ user: { id: gerente.id } });
    const r = await salvarConfigComercial({ autoLeadAtivo: false, saudacaoAtiva: true, saudacaoTexto: "" });
    expect(r.ok).toBe(false);
  });

  it("vendedor não tem alçada", async () => {
    const vendedor = await criarUsuario([Papel.VENDEDOR]);
    authMock.mockResolvedValue({ user: { id: vendedor.id } });
    const r = await salvarConfigComercial({ autoLeadAtivo: true, saudacaoAtiva: false, saudacaoTexto: "x" });
    expect(r.ok).toBe(false);
    expect(await prisma.configComercial.count()).toBe(0);
  });
});
