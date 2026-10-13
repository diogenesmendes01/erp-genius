import { describe, expect, it } from "vitest";
import type { CobrancaPublica } from "@/server/financeiro/gateway";
import { quadroDoPagamento } from "./quadro";

// docs/42 /pagar #2 e #3 (docs/43 §6 item 8): cada situação do link e da cobrança tem um quadro próprio, com
// título, explicação e saída; só pendente e vencida mantêm o caminho de pagamento.
const TOKEN = "a".repeat(48);
const cobranca = (status: string): CobrancaPublica => ({ valor: 350, moeda: "BRL", vencimentoISO: "2026-10-15T00:00:00.000Z", status, descricao: "Mensalidade — Ana (2026-10)" });

describe("quadroDoPagamento", () => {
  it("cada status da cobrança e cada falha do link cai num caso diferente", () => {
    const casos = [
      quadroDoPagamento("token-cortado", null),
      quadroDoPagamento(TOKEN, null),
      quadroDoPagamento(TOKEN, cobranca("PAGO")),
      quadroDoPagamento(TOKEN, cobranca("CANCELADA")),
      quadroDoPagamento(TOKEN, cobranca("ATRASADO")),
      quadroDoPagamento(TOKEN, cobranca("PENDENTE")),
    ];
    expect(casos.map((q) => q.caso)).toEqual(["link-invalido", "link-expirado", "paga", "cancelada", "vencida", "pendente"]);
    // Texto e saída próprios em todos (nenhum quadro repete o título de outro).
    expect(new Set(casos.map((q) => q.titulo)).size).toBe(casos.length);
    for (const q of casos) {
      expect(q.texto.length, q.caso).toBeGreaterThan(20);
      expect(q.saida.length, q.caso).toBeGreaterThan(20);
    }
  });

  it("só pendente e vencida mostram o valor e o caminho de pagamento", () => {
    const pagaveis = ["PENDENTE", "ATRASADO"];
    for (const status of ["PENDENTE", "ATRASADO", "PAGO", "CANCELADA"]) {
      const q = quadroDoPagamento(TOKEN, cobranca(status));
      expect(q.podePagar, status).toBe(pagaveis.includes(status));
      expect(q.mostraValor, status).toBe(pagaveis.includes(status));
    }
    expect(quadroDoPagamento(TOKEN, null).podePagar).toBe(false);
    expect(quadroDoPagamento("x", null).podePagar).toBe(false);
  });

  it("link fora do formato é inválido (cortado); no formato e sem cobrança, expirado ou substituído", () => {
    expect(quadroDoPagamento("ABC", null)).toMatchObject({ caso: "link-invalido", tom: "erro", titulo: "Link de pagamento inválido" });
    expect(quadroDoPagamento(TOKEN, null)).toMatchObject({ caso: "link-expirado", tom: "aviso", titulo: "Link de pagamento expirado" });
    expect(quadroDoPagamento(TOKEN, null).saida).toContain("Secretaria");
  });

  it("vencida diz a data civil do vencimento (sem passar por fuso) e pede para confirmar o valor", () => {
    const q = quadroDoPagamento(TOKEN, cobranca("ATRASADO"));
    expect(q.texto).toContain("15/10/2026");
    expect(q.texto).toContain("confirme com a escola o valor atualizado");
  });

  it("paga e cancelada dizem que não é para pagar", () => {
    expect(quadroDoPagamento(TOKEN, cobranca("PAGO")).texto).toContain("Não é preciso pagar de novo");
    expect(quadroDoPagamento(TOKEN, cobranca("CANCELADA")).texto).toContain("não deve ser paga");
  });

  it("status desconhecido é tratado como pendente (não esconde a cobrança)", () => {
    expect(quadroDoPagamento(TOKEN, cobranca("OUTRO")).caso).toBe("pendente");
  });
});
