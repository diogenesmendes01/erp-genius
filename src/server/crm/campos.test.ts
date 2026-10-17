import { describe, it, expect } from "vitest";
import { validarValorCampo } from "./campos";

describe("validarValorCampo", () => {
  it.each([
    [{ tipo: "NUMERO", opcoes: [], obrigatorio: false }, "12,5", { ok: true, valor: 12.5 }],
    [{ tipo: "NUMERO", opcoes: [], obrigatorio: false }, 7, { ok: true, valor: 7 }],
    [{ tipo: "NUMERO", opcoes: [], obrigatorio: false }, "abc", { ok: false, erro: "Número inválido." }],
    [{ tipo: "DATA", opcoes: [], obrigatorio: false }, "2026-02-28", { ok: true, valor: "2026-02-28" }],
    [{ tipo: "DATA", opcoes: [], obrigatorio: false }, "2026-02-30", { ok: false, erro: "Data inválida." }],
    [{ tipo: "DATA", opcoes: [], obrigatorio: false }, "28/02/2026", { ok: false, erro: "Data inválida." }],
    [{ tipo: "SELECAO", opcoes: ["A1", "B2"], obrigatorio: false }, "B2", { ok: true, valor: "B2" }],
    [{ tipo: "SELECAO", opcoes: ["A1", "B2"], obrigatorio: false }, "C1", { ok: false, erro: "Escolha uma das opções." }],
    [{ tipo: "BOOLEANO", opcoes: [], obrigatorio: true }, null, { ok: false, erro: "Campo obrigatório." }],
    [{ tipo: "BOOLEANO", opcoes: [], obrigatorio: true }, false, { ok: true, valor: false }],
    [{ tipo: "BOOLEANO", opcoes: [], obrigatorio: false }, "talvez", { ok: false, erro: "Valor inválido." }],
    [{ tipo: "TEXTO", opcoes: [], obrigatorio: false }, "  ", { ok: true, valor: null }],
    [{ tipo: "TEXTO", opcoes: [], obrigatorio: true }, "  ", { ok: false, erro: "Campo obrigatório." }],
    [{ tipo: "TEXTO", opcoes: [], obrigatorio: false }, " oi ", { ok: true, valor: "oi" }],
  ])("validarValorCampo %#", (c, v, esperado) => expect(validarValorCampo(c as any, v)).toEqual(esperado));
});
