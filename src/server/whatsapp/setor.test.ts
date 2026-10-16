import { describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import {
  SECRETARIA_VE_FIN_PEDAG,
  ehGerenteDoSetor,
  papeisDoSetor,
  setoresDoUsuario,
} from "./setor";

describe("setor do atendente", () => {
  it("setor vem do papel (doc 02 E3.2)", () => {
    expect(setoresDoUsuario([Papel.VENDEDOR])).toEqual(["COMERCIAL"]);
    expect(setoresDoUsuario([Papel.GERENTE_COMERCIAL])).toEqual(["COMERCIAL"]);
    expect(setoresDoUsuario([Papel.PROFESSOR])).toEqual(["PEDAGOGICO"]);
    expect(setoresDoUsuario([Papel.FINANCEIRO])).toEqual(["FINANCEIRO"]);
    expect(setoresDoUsuario([Papel.ADMINISTRADOR])).toEqual(["COMERCIAL", "FINANCEIRO", "SECRETARIA", "PEDAGOGICO"]);
    expect(setoresDoUsuario([Papel.ALUNO])).toEqual([]);
  });
  it("Q1: secretaria mantém FIN e PEDAG enquanto SECRETARIA_VE_FIN_PEDAG = true", () => {
    expect(SECRETARIA_VE_FIN_PEDAG).toBe(true);
    expect(setoresDoUsuario([Papel.SECRETARIA_ACADEMICA])).toEqual(["SECRETARIA", "FINANCEIRO", "PEDAGOGICO"]);
  });
  it("gerente só existe em COMERCIAL e PEDAGOGICO; admin gerencia todos", () => {
    expect(ehGerenteDoSetor([Papel.GERENTE_COMERCIAL], "COMERCIAL")).toBe(true);
    expect(ehGerenteDoSetor([Papel.GERENTE_PEDAGOGICO], "PEDAGOGICO")).toBe(true);
    expect(ehGerenteDoSetor([Papel.FINANCEIRO], "FINANCEIRO")).toBe(false);
    expect(ehGerenteDoSetor([Papel.ADMINISTRADOR], "SECRETARIA")).toBe(true);
    expect(papeisDoSetor("PEDAGOGICO")).toEqual([Papel.GERENTE_PEDAGOGICO, Papel.PROFESSOR]);
  });
  it("multi-papel é a união sem repetição", () => {
    expect(setoresDoUsuario([Papel.VENDEDOR, Papel.GERENTE_COMERCIAL])).toEqual(["COMERCIAL"]);
    expect(setoresDoUsuario([Papel.VENDEDOR, Papel.FINANCEIRO])).toEqual(["COMERCIAL", "FINANCEIRO"]);
  });
});
