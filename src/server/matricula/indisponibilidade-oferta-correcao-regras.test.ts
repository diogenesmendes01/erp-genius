import { describe, expect, it } from "vitest";
import { conferirCorrecaoPeriodoRelato, diasRemovidosPelaCorrecao } from "./indisponibilidade-oferta-correcao-regras";

const fechado = { inicio: "2026-03-10", fim: "2026-03-20" }, aberto = { inicio: "2026-03-10", fim: null };

describe("conferirCorrecaoPeriodoRelato (Q157)", () => {
  it("aceita mudar início e fim de relato encerrado e só o início de relato aberto", () => {
    expect(() => conferirCorrecaoPeriodoRelato(fechado, { inicio: "2026-03-08", fim: "2026-03-18" }, null)).not.toThrow();
    expect(() => conferirCorrecaoPeriodoRelato(aberto, { inicio: "2026-03-12", fim: null }, null)).not.toThrow();
  });
  it.each([
    ["sem alteração", fechado, { ...fechado }, null, /não altera/],
    ["fim em relato aberto", aberto, { inicio: "2026-03-10", fim: "2026-03-15" }, null, /término aprovado/],
    ["reabrir relato encerrado", fechado, { inicio: "2026-03-10", fim: null }, null, /não reabre/],
    ["início depois do fim", fechado, { inicio: "2026-03-21", fim: "2026-03-20" }, null, /ultrapassar/],
    ["início depois do término aprovado", aberto, { inicio: "2026-04-02", fim: null }, "2026-04-01", /ultrapassar/],
  ])("recusa %s", (_nome, atual, novo, termino, erro) => {
    expect(() => conferirCorrecaoPeriodoRelato(atual, novo, termino)).toThrow(erro);
  });
});

describe("diasRemovidosPelaCorrecao", () => {
  it("nada é removido quando o período só cresce", () => {
    expect(diasRemovidosPelaCorrecao(fechado, { inicio: "2026-03-01", fim: "2026-03-25" }, null)).toEqual([]);
  });
  it("início posterior e fim anterior removem as duas pontas", () => {
    expect(diasRemovidosPelaCorrecao(fechado, { inicio: "2026-03-12", fim: "2026-03-18" }, null)).toEqual([
      { inicio: "2026-03-10", fim: "2026-03-11" }, { inicio: "2026-03-19", fim: "2026-03-20" }]);
  });
  it("relato aberto usa o término aprovado, ou fica aberto", () => {
    expect(diasRemovidosPelaCorrecao(aberto, { inicio: "2026-03-15", fim: null }, "2026-04-01")).toEqual([{ inicio: "2026-03-10", fim: "2026-03-14" }]);
    expect(diasRemovidosPelaCorrecao(aberto, { inicio: "2026-03-15", fim: null }, null)).toEqual([{ inicio: "2026-03-10", fim: "2026-03-14" }]);
  });
  it("deslocamento sem sobreposição remove o período inteiro", () => {
    expect(diasRemovidosPelaCorrecao(fechado, { inicio: "2026-04-01", fim: "2026-04-05" }, null)).toEqual([{ inicio: "2026-03-10", fim: "2026-03-20" }]);
  });
});
