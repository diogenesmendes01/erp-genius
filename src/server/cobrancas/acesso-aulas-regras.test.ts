import { describe, expect, it } from "vitest";
import { acessoEfetivoBloqueado, cobrancaGeraRestricaoAutomatica, type CobrancaParaRestricao } from "./acesso-aulas-regras";

const FUSO = "America/Sao_Paulo";
// Meio-dia de Brasília (15h UTC): o mesmo dia civil com TZ=UTC e America/Sao_Paulo.
const agora = new Date(Date.UTC(2026, 8, 8, 15));
const cobranca = (dias: number, extra: Partial<CobrancaParaRestricao> = {}): CobrancaParaRestricao => ({
  status: "ATRASADO", vencimento: new Date(Date.UTC(2026, 8, 8 - dias, 15)), saldo: 40, valorNegociado: 100, valorRecebido: 60, ...extra,
});

describe("restrição de aulas por dívida elegível", () => {
  it.each([0, 15, 29])("%s dias não geram restrição automática", (dias) => expect(cobrancaGeraRestricaoAutomatica(cobranca(dias), agora, FUSO)).toBe(false));
  it.each([30, 31, 90])("%s dias com saldo parcial geram restrição automática", (dias) => expect(cobrancaGeraRestricaoAutomatica(cobranca(dias), agora, FUSO)).toBe(true));
  it.each([{ status: "CANCELADA" }, { status: "PAGO" }, { saldo: 0 }])("quitada ou cancelada não restringe: %j", (extra) => expect(cobrancaGeraRestricaoAutomatica(cobranca(90, extra), agora, FUSO)).toBe(false));
  it("saldo legado desconta recebimentos em vez de cobrar o valor cheio", () => {
    expect(cobrancaGeraRestricaoAutomatica(cobranca(30, { saldo: null, valorRecebido: 100 }), agora, FUSO)).toBe(false);
    expect(cobrancaGeraRestricaoAutomatica(cobranca(30, { saldo: null, valorRecebido: 60 }), agora, FUSO)).toBe(true);
  });
  it("somente saldo efetivamente regularizado deixa de gerar restrição", () => {
    expect(cobrancaGeraRestricaoAutomatica(cobranca(30, { valorRecebido: 0, saldo: 100 }), agora, FUSO)).toBe(true);
    expect(cobrancaGeraRestricaoAutomatica(cobranca(30, { valorRecebido: 100, saldo: 0 }), agora, FUSO)).toBe(false);
  });
  it("regularização automática preserva o componente manual", () => {
    expect(acessoEfetivoBloqueado(true, false)).toBe(true);
    expect(acessoEfetivoBloqueado(false, true)).toBe(true);
    expect(acessoEfetivoBloqueado(false, false)).toBe(false);
  });
});

describe("Q176 — D+30 vira à meia-noite da escola, não do servidor", () => {
  const vencida = cobranca(0, { vencimento: new Date("2026-06-23T15:00:00Z") }); // vence 23/06
  it("às 23h30 de Brasília do 29º dia (02h30 UTC do dia seguinte) ainda não restringe", () => {
    expect(cobrancaGeraRestricaoAutomatica(vencida, new Date("2026-07-23T02:30:00Z"), FUSO)).toBe(false); // 22/07, 23h30
  });
  it("à 00h30 de Brasília do 30º dia restringe", () => {
    expect(cobrancaGeraRestricaoAutomatica(vencida, new Date("2026-07-23T03:30:00Z"), FUSO)).toBe(true); // 23/07, 00h30
  });
  it("vencimento legado gravado à meia-noite UTC conta pelo próprio dia", () => {
    const legado = cobranca(0, { vencimento: new Date("2026-06-23T00:00:00Z") });
    expect(cobrancaGeraRestricaoAutomatica(legado, new Date("2026-07-23T02:30:00Z"), FUSO)).toBe(false);
    expect(cobrancaGeraRestricaoAutomatica(legado, new Date("2026-07-23T03:30:00Z"), FUSO)).toBe(true);
  });
});
