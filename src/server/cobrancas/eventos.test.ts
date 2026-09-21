import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { cicloDoEventoCobranca, registrarEventoCobrancaEnviada } from "./eventos";

describe("ciclo no histórico de envios de cobrança", () => {
  it("envio legado sem ciclo pertence somente ao ciclo 0", () => {
    expect(cicloDoEventoCobranca({ modelo: "amigavel", passo: "D-7", canal: "manual" })).toBe(0);
    expect(cicloDoEventoCobranca(null)).toBe(0);
  });
  it.each([0, 1, 12])("preserva ciclo explícito %i", (cicloRegua) => {
    expect(cicloDoEventoCobranca({ passo: "D-7", cicloRegua })).toBe(cicloRegua);
  });
  it.each([-1, 1.5, "1", null])("ciclo inválido %s não cumpre passo de outro ciclo", (cicloRegua) => {
    expect(cicloDoEventoCobranca({ cicloRegua })).toBeNull();
  });
  it("grava o ciclo do envio informado sem consultar o calendário depois do provedor", async () => {
    const create = vi.fn();
    const tx = { evento: { create } } as unknown as Prisma.TransactionClient;
    await registrarEventoCobrancaEnviada(tx, { cobrancaId: "c", passo: "D-7", modelo: "amigavel", canal: "api", autorId: null, cicloRegua: 2 });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      tipo: "CobrancaEnviadaWhatsApp", agregadoId: "c", versao: 3,
      payload: { passo: "D-7", modelo: "amigavel", canal: "api", cicloRegua: 2 },
    }) });
  });
});
