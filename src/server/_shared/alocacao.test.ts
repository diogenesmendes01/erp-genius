import { describe, it, expect } from "vitest";
import { alocarPagamento } from "./regras";

// Lastro financeiro da ativação (issue #23): a alocação NÃO pode presumir
// quitação. Cobrança só é "quitada" quando o valor a cobre integralmente.
describe("alocarPagamento", () => {
  const taxa = { id: "taxa", valorNegociado: 100 };
  const mensalidade = { id: "mens", valorNegociado: 300 };

  it("paga tudo quando o valor cobre o total (ordem taxa → mensalidade)", () => {
    const r = alocarPagamento(400, [taxa, mensalidade]);
    expect(r.totalDevido).toBe(400);
    expect(r.quitouTudo).toBe(true);
    expect(r.troco).toBe(0);
    expect(r.alocacoes).toEqual([
      { id: "taxa", valorRecebido: 100, saldo: 0, quitada: true },
      { id: "mens", valorRecebido: 300, saldo: 0, quitada: true },
    ]);
  });

  it("cobre só a primeira cobrança e deixa a segunda pendente (parcial)", () => {
    const r = alocarPagamento(100, [taxa, mensalidade]);
    expect(r.quitouTudo).toBe(false);
    expect(r.alocacoes[0]).toMatchObject({ id: "taxa", quitada: true, saldo: 0 });
    expect(r.alocacoes[1]).toMatchObject({ id: "mens", valorRecebido: 0, saldo: 300, quitada: false });
  });

  it("aplica parcial na segunda cobrança sem marcá-la como quitada", () => {
    const r = alocarPagamento(250, [taxa, mensalidade]);
    expect(r.alocacoes[0]).toMatchObject({ id: "taxa", quitada: true });
    expect(r.alocacoes[1]).toMatchObject({ valorRecebido: 150, saldo: 150, quitada: false });
    expect(r.quitouTudo).toBe(false);
  });

  it("não quita nada quando o valor é zero", () => {
    const r = alocarPagamento(0, [taxa, mensalidade]);
    expect(r.alocacoes.every((a) => !a.quitada)).toBe(true);
    expect(r.quitouTudo).toBe(false);
  });

  it("calcula troco quando o valor excede o total", () => {
    const r = alocarPagamento(500, [taxa, mensalidade]);
    expect(r.quitouTudo).toBe(true);
    expect(r.troco).toBe(100);
  });

  it("ignora valor negativo (trata como zero)", () => {
    const r = alocarPagamento(-50, [taxa]);
    expect(r.alocacoes[0]).toMatchObject({ valorRecebido: 0, saldo: 100, quitada: false });
  });
});
