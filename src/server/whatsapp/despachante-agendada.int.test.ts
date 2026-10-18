import { DriverWhatsApp } from "@prisma/client";
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { despacharFila } from "./despachante";

beforeEach(async () => {
  await truncarBanco();
});

async function seed(agendadaPara: Date | null, status: "PENDENTE" | "ADIADA" = "PENDENTE") {
  const numero = await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511955550101", rotulo: "Vendas", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", providerRef: "inst-da" },
  });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688887777" } });
  return prisma.intencaoMensagem.create({
    data: {
      numeroId: numero.id, contatoId: contato.id, origem: "HUMANO", corpoRenderizado: "Oi", agendadaPara, status,
      despacharAposEm: status === "ADIADA" ? new Date(Date.now() - 60_000) : null,
    },
  });
}

describe("despachante × mensagem agendada", () => {
  it("despachante não pega PENDENTE com agendadaPara no futuro", async () => {
    const agora = new Date();
    const futura = await seed(new Date(agora.getTime() + 3600_000));
    const r = await despacharFila(agora, { intencaoId: futura.id });
    expect(r.avaliadas).toBe(0);
    expect((await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: futura.id } })).status).toBe("PENDENTE");
  });

  it("ADIADA vencida com agendadaPara no futuro também espera", async () => {
    const agora = new Date();
    const futura = await seed(new Date(agora.getTime() + 3600_000), "ADIADA");
    const r = await despacharFila(agora, { intencaoId: futura.id });
    expect(r.avaliadas).toBe(0);
  });

  it("agendadaPara vencida ou nula entra na fila", async () => {
    const agora = new Date();
    const vencida = await seed(new Date(agora.getTime() - 60_000));
    expect((await despacharFila(agora, { intencaoId: vencida.id })).avaliadas).toBe(1);
  });
});
