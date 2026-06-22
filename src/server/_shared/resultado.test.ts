import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { executarAcao } from "./resultado";
import { ErroRegra, ErroPermissao } from "./sessao";

describe("executarAcao", () => {
  it("retorna {ok:true, dado} no sucesso", async () => {
    const r = await executarAcao(async () => 42);
    expect(r).toEqual({ ok: true, dado: 42 });
  });

  it("mapeia ErroRegra para a mensagem", async () => {
    const r = await executarAcao(async () => {
      throw new ErroRegra("Limite excedido");
    });
    expect(r).toEqual({ ok: false, erro: "Limite excedido" });
  });

  it("mapeia ErroPermissao", async () => {
    const r = await executarAcao(async () => {
      throw new ErroPermissao();
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/permiss/i);
  });

  it("usa a 1ª mensagem do ZodError", async () => {
    const r = await executarAcao(async () => {
      z.object({ nome: z.string().min(1, "Informe o nome") }).parse({ nome: "" });
    });
    expect(r).toEqual({ ok: false, erro: "Informe o nome" });
  });

  it("erro inesperado vira mensagem genérica", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await executarAcao(async () => {
      throw new Error("boom interno");
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/inesperado/i);
    spy.mockRestore();
  });
});
