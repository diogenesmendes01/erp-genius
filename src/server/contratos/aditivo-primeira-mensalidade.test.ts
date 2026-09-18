import { expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { consultarAlvoPrimeiraMensalidadeTx } from "./aditivo-primeira-mensalidade";
const valor = { tipo: "DATA", data: "2028-02-29" };
const cobranca = { id: "primeira", matriculaId: "contrato", versao: 3, status: "PAGO", vencimento: new Date("2028-02-10T12:00:00Z") };
function banco(itens: unknown[]) {
  const findMany = vi.fn().mockResolvedValue(itens);
  return { tx: { itemEmissaoEntrada: { findMany } } as unknown as Prisma.TransactionClient, findMany };
}
it("localiza pela origem e preserva cobrança paga, sem transformar proposta em aplicação", async () => {
  const { tx, findMany } = banco([{ cobranca }]);
  const resultado = await consultarAlvoPrimeiraMensalidadeTx(tx, "contrato", valor);
  expect(findMany.mock.calls[0][0].where).toEqual({ matriculaId: "contrato", cobranca: { tipo: "MENSALIDADE" } });
  expect(resultado).toMatchObject({ vencimentoProposto: "2028-02-29", cobranca: { id: "primeira", versao: 3 } });
  expect(resultado.pendencia).toContain("aprovação financeira independente");
  expect(cobranca.status).toBe("PAGO");
  expect(cobranca.vencimento.toISOString()).toBe("2028-02-10T12:00:00.000Z");
});
it("não escolhe cobrança arbitrária quando falta origem ou há ambiguidade", async () => {
  for (const itens of [[], [{ cobranca }, { cobranca: { ...cobranca, id: "outra" } }]]) {
    const resultado = await consultarAlvoPrimeiraMensalidadeTx(banco(itens).tx, "contrato", valor);
    expect(resultado.cobranca).toBeNull();
    expect(resultado.pendencia).toContain("origem");
  }
});
it("recusa outro contrato e datas impossíveis; cobrança cancelada permanece em conferência", async () => {
  await expect(consultarAlvoPrimeiraMensalidadeTx(banco([{ cobranca }]).tx, "outro", valor)).rejects.toThrow("outro contrato");
  const b = banco([]);
  await expect(consultarAlvoPrimeiraMensalidadeTx(b.tx, "contrato", { tipo: "DATA", data: "2027-02-29" })).rejects.toThrow();
  expect(b.findMany).not.toHaveBeenCalled();
  expect((await consultarAlvoPrimeiraMensalidadeTx(banco([{ cobranca: { ...cobranca, status: "CANCELADA" } }]).tx, "contrato", valor)).pendencia).toContain("cancelada");
});
