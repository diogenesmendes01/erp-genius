import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { setoresDoNumero, whereNumeroServeSetor } from "./numero-setor";

beforeEach(async () => {
  await truncarBanco();
});

describe("número × setor", () => {
  it("um número serve vários setores, sem repetir setor", async () => {
    const n = await criarNumeroSetor({ telefoneE164: "+5511900000001", setores: ["FINANCEIRO", "SECRETARIA"] });
    expect(await setoresDoNumero(prisma, n.id)).toEqual(["FINANCEIRO", "SECRETARIA"]);
    await expect(
      prisma.numeroSetorWhatsApp.create({ data: { numeroId: n.id, finalidade: "FINANCEIRO" } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("número legado sem setor cadastrado: COBRANCA serve FINANCEIRO, VENDAS serve COMERCIAL, AGENDA nada", async () => {
    const cobr = await criarNumeroSetor({ telefoneE164: "+5511900000002", setores: [], finalidade: "COBRANCA" });
    const ag = await criarNumeroSetor({ telefoneE164: "+5511900000003", setores: [], finalidade: "AGENDA" });
    const fin = await prisma.numeroWhatsApp.findMany({ where: whereNumeroServeSetor("FINANCEIRO"), select: { id: true } });
    expect(fin.map((x) => x.id)).toEqual([cobr.id]);
    expect(await setoresDoNumero(prisma, ag.id)).toEqual([]);
  });
});
