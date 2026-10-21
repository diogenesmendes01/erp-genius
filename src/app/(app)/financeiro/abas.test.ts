import { describe, expect, it } from "vitest";
import { abasVisiveis, resolverAba, type PermissoesFinanceiro } from "./abas";

const ADMIN: PermissoesFinanceiro = { podeOperarCobranca: true, podeAprovar: true, podeGerenciarCambio: true, podeConfigurarPoliticas: true };
const FINANCEIRO: PermissoesFinanceiro = { podeOperarCobranca: true, podeAprovar: false, podeGerenciarCambio: true, podeConfigurarPoliticas: false };
const GERENTE: PermissoesFinanceiro = { podeOperarCobranca: false, podeAprovar: true, podeGerenciarCambio: false, podeConfigurarPoliticas: false };

describe("abas do financeiro", () => {
  it("cada papel enxerga as abas de antes, na mesma ordem", () => {
    expect(abasVisiveis(ADMIN)).toEqual(["cobrancas", "informes", "retomadas", "comissoes", "descontos", "geral", "politicas", "aprovacoes", "cambio"]);
    expect(abasVisiveis(FINANCEIRO)).toEqual(["cobrancas", "informes", "retomadas", "comissoes", "descontos", "geral", "cambio"]);
    expect(abasVisiveis(GERENTE)).toEqual(["comissoes", "descontos", "aprovacoes"]);
    expect(abasVisiveis({ ...GERENTE, podeConfigurarPoliticas: true })).toContain("politicas");
  });

  it("sem ?aba=, abre na padrão do papel", () => {
    expect(resolverAba(undefined, FINANCEIRO)).toBe("cobrancas");
    expect(resolverAba(undefined, GERENTE)).toBe("comissoes");
  });

  it("aba pedida e visível é respeitada", () => {
    expect(resolverAba("cambio", FINANCEIRO)).toBe("cambio");
    expect(resolverAba("aprovacoes", GERENTE)).toBe("aprovacoes");
  });

  it("aba proibida para o papel ou inexistente cai na padrão — nunca abre a aba (nem a consulta) de outro papel", () => {
    expect(resolverAba("cobrancas", GERENTE)).toBe("comissoes");
    expect(resolverAba("politicas", FINANCEIRO)).toBe("cobrancas");
    expect(resolverAba("aprovacoes", FINANCEIRO)).toBe("cobrancas");
    expect(resolverAba("qualquer", ADMIN)).toBe("cobrancas");
    expect(resolverAba("", GERENTE)).toBe("comissoes");
  });
});
