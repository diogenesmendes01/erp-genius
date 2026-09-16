import { describe, expect, it } from "vitest";
import { resolverHoraVigente } from "./aditivo-hora-vigente";
import { hashSubstituicao } from "./substituicao-estado";
import { Prisma } from "@prisma/client";

const hora = (valor = "200", moeda = "CRC") => ({ HORA_VALOR: { tipo: "DINHEIRO", valor, moeda } });
const versao = (condicoes: Prisma.JsonObject, inicio = "2026-01-01T00:00:00Z", n = 1) => ({ id: `v${n}`, versao: n, condicoes, condicoesHash: hashSubstituicao(condicoes), vigenciaInicio: new Date(inicio) });
const inicio = new Date("2026-01-10T15:00:00Z"), fim = new Date("2026-01-10T16:00:00Z");
const resolver = (v: ReturnType<typeof versao>[]) => resolverHoraVigente(v, inicio, fim, "125.00", "CRC");
describe("preço por hora formalizado", () => {
  it("usa o preço efetivo e preserva o original antes da vigência", () => {
    expect(resolver([versao(hora())])).toMatchObject({ valorHora: "200", moeda: "CRC", versaoAditivo: { id: "v1" } });
    expect(resolver([versao(hora(), fim.toISOString())])).toMatchObject({ valorHora: "125.00", versaoAditivo: null });
  });
  it("bloqueia o primeiro aditivo financeiro durante o encontro", () => expect(() => resolver([versao(hora(), "2026-01-10T15:30:00Z")])).toThrow(/durante/));
  it("mudança cadastral com preço herdado não interrompe o encontro", () => expect(resolver([versao(hora()), versao({ ...hora(), ALUNO_NOME: { tipo: "TEXT", texto: "Nome corrigido" } }, "2026-01-10T15:30:00Z", 2)])).toMatchObject({ valorHora: "200" }));
  it("não interrompe por ordem diferente das chaves financeiras equivalentes", () => {
    const primeiro = { REGIME: { tipo: "REGIME" as const, regime: "HORA_PARTICULAR" as const }, ...hora(), MOEDA: { tipo: "MOEDA" as const, moeda: "CRC" } };
    const segundo = { MOEDA: { tipo: "MOEDA" as const, moeda: "CRC" }, HORA_VALOR: { tipo: "DINHEIRO" as const, valor: "200", moeda: "CRC" }, REGIME: { tipo: "REGIME" as const, regime: "HORA_PARTICULAR" as const }, PAGADOR_NOME: { tipo: "TEXT" as const, texto: "Pagador" } };
    expect(resolver([versao(primeiro), versao(segundo, "2026-01-10T15:30:00Z", 2)])).toMatchObject({ valorHora: "200" });
  });
  it("mudança de preço durante o encontro exige conferência", () => expect(() => resolver([versao(hora()), versao(hora("300"), "2026-01-10T15:30:00Z", 2)])).toThrow(/durante/));
  it("recusa moeda divergente no próprio preço", () => expect(() => resolver([versao(hora("200", "BRL"))])).toThrow(/moeda/));
  it("recusa hash alterado em versão que começa durante o encontro", () => expect(() => resolver([{ ...versao({}, "2026-01-10T15:30:00Z"), condicoesHash: "0".repeat(64) }])).toThrow(/divergentes/));
});
