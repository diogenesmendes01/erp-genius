import { describe, expect, it } from "vitest";
import { acessoEfetivoBloqueado, cobrancaGeraRestricaoAutomatica, type CobrancaParaRestricao } from "./acesso-aulas-regras";

const agora = new Date(2026, 8, 8, 12);
const cobranca = (dias: number, extra: Partial<CobrancaParaRestricao> = {}): CobrancaParaRestricao => ({
  status: "ATRASADO", vencimento: new Date(2026, 8, 8 - dias, 12), saldo: 40, valorNegociado: 100, valorRecebido: 60, ...extra,
});

describe("restrição de aulas por dívida elegível", () => {
  it.each([0, 15, 29])("%s dias não geram restrição automática", (dias) => expect(cobrancaGeraRestricaoAutomatica(cobranca(dias), agora)).toBe(false));
  it.each([30, 31, 90])("%s dias com saldo parcial geram restrição automática", (dias) => expect(cobrancaGeraRestricaoAutomatica(cobranca(dias), agora)).toBe(true));
  it.each([{ status: "CANCELADA" }, { status: "PAGO" }, { saldo: 0 }])("quitada ou cancelada não restringe: %j", (extra) => expect(cobrancaGeraRestricaoAutomatica(cobranca(90, extra), agora)).toBe(false));
  it("saldo legado desconta recebimentos em vez de cobrar o valor cheio", () => {
    expect(cobrancaGeraRestricaoAutomatica(cobranca(30, { saldo: null, valorRecebido: 100 }), agora)).toBe(false);
    expect(cobrancaGeraRestricaoAutomatica(cobranca(30, { saldo: null, valorRecebido: 60 }), agora)).toBe(true);
  });
  it("somente saldo efetivamente regularizado deixa de gerar restrição", () => {
    expect(cobrancaGeraRestricaoAutomatica(cobranca(30, { valorRecebido: 0, saldo: 100 }), agora)).toBe(true);
    expect(cobrancaGeraRestricaoAutomatica(cobranca(30, { valorRecebido: 100, saldo: 0 }), agora)).toBe(false);
  });
  it("regularização automática preserva o componente manual", () => {
    expect(acessoEfetivoBloqueado(true, false)).toBe(true);
    expect(acessoEfetivoBloqueado(false, true)).toBe(true);
    expect(acessoEfetivoBloqueado(false, false)).toBe(false);
  });
});
