import { describe, it, expect } from "vitest";
import { Papel } from "@prisma/client";
import { escopoNumeros, usuarioVeNumero } from "./escopo";

// Escopo row-level da conversa (gap D22 → decisão S11 da E3): a conversa é do NÚMERO.

const usuario = (id: string, ...papeis: Papel[]) => ({ id, nome: "t", papeis });

describe("escopoNumeros", () => {
  it("admin vê tudo", () => {
    expect(escopoNumeros(usuario("u1", Papel.ADMINISTRADOR))).toEqual({});
  });

  it("financeiro/secretaria veem números de COBRANCA", () => {
    expect(escopoNumeros(usuario("u1", Papel.FINANCEIRO))).toEqual({ OR: [{ finalidade: "COBRANCA" }] });
    expect(escopoNumeros(usuario("u1", Papel.SECRETARIA_ACADEMICA))).toEqual({ OR: [{ finalidade: "COBRANCA" }] });
  });

  it("gerente comercial supervisiona VENDAS; vendedor só os números que possui", () => {
    expect(escopoNumeros(usuario("u1", Papel.GERENTE_COMERCIAL))).toEqual({ OR: [{ finalidade: "VENDAS" }] });
    expect(escopoNumeros(usuario("v1", Papel.VENDEDOR))).toEqual({ OR: [{ donoId: "v1" }] });
  });

  it("papéis acumulam (financeiro + vendedor)", () => {
    expect(escopoNumeros(usuario("v1", Papel.FINANCEIRO, Papel.VENDEDOR))).toEqual({
      OR: [{ finalidade: "COBRANCA" }, { donoId: "v1" }],
    });
  });

  it("papel sem acesso → fail-closed (não casa com nada)", () => {
    expect(escopoNumeros(usuario("p1", Papel.PROFESSOR))).toEqual({ id: "__sem_acesso__" });
  });
});

describe("usuarioVeNumero (autorização de mídia por objeto)", () => {
  const cobranca = { donoId: null, finalidade: "COBRANCA" };
  const vendasDeV1 = { donoId: "v1", finalidade: "VENDAS" };

  it("espelha o escopo: papel × finalidade × dono", () => {
    expect(usuarioVeNumero(usuario("a", Papel.ADMINISTRADOR), vendasDeV1)).toBe(true);
    expect(usuarioVeNumero(usuario("f", Papel.FINANCEIRO), cobranca)).toBe(true);
    expect(usuarioVeNumero(usuario("f", Papel.FINANCEIRO), vendasDeV1)).toBe(false);
    expect(usuarioVeNumero(usuario("g", Papel.GERENTE_COMERCIAL), vendasDeV1)).toBe(true);
    expect(usuarioVeNumero(usuario("g", Papel.GERENTE_COMERCIAL), cobranca)).toBe(false);
    expect(usuarioVeNumero(usuario("v1", Papel.VENDEDOR), vendasDeV1)).toBe(true);
    expect(usuarioVeNumero(usuario("v2", Papel.VENDEDOR), vendasDeV1)).toBe(false);
    expect(usuarioVeNumero(usuario("p", Papel.PROFESSOR), cobranca)).toBe(false);
  });
});
