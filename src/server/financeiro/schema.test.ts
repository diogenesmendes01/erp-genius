import { describe, it, expect } from "vitest";
import { FormaPagamento } from "@prisma/client";
import { PagamentoSchema, FORMAS_EXIGEM_COMPROVANTE } from "./schema";

describe("PagamentoSchema — comprovante", () => {
  it("exige comprovante em formas que geram prova (transferência/GreenPay)", () => {
    for (const forma of FORMAS_EXIGEM_COMPROVANTE) {
      const r = PagamentoSchema.safeParse({ valorRecebido: 100, forma });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues.some((i) => i.path.includes("comprovanteUrl"))).toBe(true);
      }
    }
  });

  it("aceita transferência quando o comprovante é anexado", () => {
    const r = PagamentoSchema.safeParse({
      valorRecebido: 100,
      forma: FormaPagamento.TRANSFERENCIA,
      comprovanteUrl: "/uploads/comprovante.pdf",
      comprovanteNome: "comprovante.pdf",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.comprovanteUrl).toBe("/uploads/comprovante.pdf");
      expect(r.data.comprovanteNome).toBe("comprovante.pdf");
    }
  });

  it("não exige comprovante para dinheiro/cartão", () => {
    expect(PagamentoSchema.safeParse({ valorRecebido: 50, forma: FormaPagamento.DINHEIRO }).success).toBe(true);
    expect(PagamentoSchema.safeParse({ valorRecebido: 50, forma: FormaPagamento.CARTAO }).success).toBe(true);
  });

  it("trata string vazia de comprovante como ausente (e bloqueia transferência)", () => {
    const r = PagamentoSchema.safeParse({
      valorRecebido: 100,
      forma: FormaPagamento.TRANSFERENCIA,
      comprovanteUrl: "   ",
    });
    expect(r.success).toBe(false);
  });
});
