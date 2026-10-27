import { DriverWhatsApp } from "@prisma/client";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { despacharFila } from "./despachante";

beforeEach(async () => {
  await truncarBanco();
});

describe("B3 — validade do disparo (validaAte)", () => {
  it("despachante CANCELA intenção vencida (inclusive ADIADA) — nunca envia", async () => {
    const numero = await prisma.numeroWhatsApp.create({
      data: { telefoneE164: "+5511900001111", rotulo: "Vendas", driver: DriverWhatsApp.MOTOR, finalidade: "VENDAS", providerRef: "inst-piloto" },
    });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50690001111" } });

    await prisma.intencaoMensagem.create({
      data: {
        numeroId: numero.id,
        contatoId: contato.id,
        origem: "CRON",
        status: "ADIADA",
        despacharAposEm: new Date(Date.now() - 60_000),
        corpoRenderizado: "Sua aula é amanhã!",
        validaAte: new Date(Date.now() - 30 * 60_000),
      },
    });

    const r = await despacharFila();

    expect(r.canceladas).toBe(1);
    const intencao = await prisma.intencaoMensagem.findFirstOrThrow();
    expect(intencao.status).toBe("CANCELADA");
    expect(intencao.motivoFalha).toBe("validade_expirada");
  });
});
