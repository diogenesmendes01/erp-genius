import { describe, expect, it } from "vitest";
import { projetarDetalhesMovimentacao } from "./movimentacoes-detalhes";
describe("projeção dos impactos registrados", () => {
  it("mantém cobertura anterior/proposta e descarta valores extras em todos os níveis", () => {
    const snapshot = { retorno: "2026-12-10", fusoInstitucional: "UTC", segredo: "PRIVADO", matriculas: [{
      matriculaId: "m1", codigo: "M-1", pendencias: [], pausaId: "p1", valor: "PRIVADO", periodos: [{
        cobrancaId: "c1", coberturaAnterior: { inicio: "2026-10-01", fim: "2026-10-31", saldo: "PRIVADO" },
        cobertura: { inicio: "2026-12-10", fim: "2026-12-31" }, vencimentoAnterior: "2026-10-05", vencimento: "2026-12-15", valorNegociado: "PRIVADO",
      }],
    }] };
    const r = projetarDetalhesMovimentacao("RETOMADA", snapshot);
    expect(r).toMatchObject({ impactos: { matriculas: [{ periodos: [{ vencimentoAnterior: "2026-10-05", vencimento: "2026-12-15" }] }] } });
    expect(JSON.stringify(r)).not.toContain("PRIVADO");
  });
  it("não inventa impactos quando falta informação histórica", () => {
    expect(projetarDetalhesMovimentacao("PAUSA", { dataEfetiva: "2026-09-15" })).toBeNull();
  });
});
