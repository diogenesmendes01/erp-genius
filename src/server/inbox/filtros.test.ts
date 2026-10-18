import { describe, expect, it } from "vitest";
import { lerFiltrosInbox } from "./filtros";

describe("filtros da URL do inbox", () => {
  it("filtros da URL; valor inválido é ignorado", () => {
    expect(lerFiltrosInbox({ setor: "FINANCEIRO", status: "FOO", naoLidas: "1", prazo: "estourado" })).toEqual({ setor: "FINANCEIRO", naoLidas: true, prazoEstourado: true });
  });
  it("setor inválido, naoLidas falso e prazo diferente de estourado somem", () => {
    expect(lerFiltrosInbox({ setor: "RH", naoLidas: "0", prazo: "ok" })).toEqual({});
  });
  it("aliases da URL da tela: numero e resp", () => {
    expect(lerFiltrosInbox({ numero: "n1", resp: "eu" })).toEqual({ numeroId: "n1", responsavel: "eu" });
  });
  it("numero, responsavel, status e busca; arrays pegam o primeiro valor", () => {
    expect(lerFiltrosInbox({ numeroId: "n1", responsavel: ["eu", "x"], status: "EM_ATENDIMENTO", busca: "  maria  " }))
      .toEqual({ numeroId: "n1", responsavel: "eu", status: "EM_ATENDIMENTO", busca: "maria" });
    expect(lerFiltrosInbox({ responsavel: "fila" })).toEqual({ responsavel: "fila" });
    expect(lerFiltrosInbox({ responsavel: "u123" })).toEqual({ responsavel: "u123" });
  });
});
