import { describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { setoresDoUsuario as setoresCrmDoUsuario } from "@/server/crm/setores-papel";
import {
  SECRETARIA_VE_FIN_PEDAG,
  SETORES,
  ehGerenteDoSetor,
  papeisDeTriagem,
  papeisDoSetor,
  podeTriarSetores,
  setoresVisiveisNoInbox,
} from "./setor";

describe("setor do atendente", () => {
  it("setor vem do papel (doc 02 E3.2)", () => {
    expect(setoresVisiveisNoInbox([Papel.VENDEDOR])).toEqual(["COMERCIAL"]);
    expect(setoresVisiveisNoInbox([Papel.GERENTE_COMERCIAL])).toEqual(["COMERCIAL"]);
    expect(setoresVisiveisNoInbox([Papel.PROFESSOR])).toEqual(["PEDAGOGICO"]);
    expect(setoresVisiveisNoInbox([Papel.FINANCEIRO])).toEqual(["FINANCEIRO"]);
    expect(setoresVisiveisNoInbox([Papel.ADMINISTRADOR])).toEqual(["COMERCIAL", "FINANCEIRO", "SECRETARIA", "PEDAGOGICO"]);
    expect(setoresVisiveisNoInbox([Papel.ALUNO])).toEqual([]);
  });
  it("Q1: secretaria mantém FIN e PEDAG enquanto SECRETARIA_VE_FIN_PEDAG = true", () => {
    expect(SECRETARIA_VE_FIN_PEDAG).toBe(true);
    expect(setoresVisiveisNoInbox([Papel.SECRETARIA_ACADEMICA])).toEqual(["SECRETARIA", "FINANCEIRO", "PEDAGOGICO"]);
  });
  it("gerente só existe em COMERCIAL e PEDAGOGICO; admin gerencia todos", () => {
    expect(ehGerenteDoSetor([Papel.GERENTE_COMERCIAL], "COMERCIAL")).toBe(true);
    expect(ehGerenteDoSetor([Papel.GERENTE_PEDAGOGICO], "PEDAGOGICO")).toBe(true);
    expect(ehGerenteDoSetor([Papel.FINANCEIRO], "FINANCEIRO")).toBe(false);
    expect(ehGerenteDoSetor([Papel.ADMINISTRADOR], "SECRETARIA")).toBe(true);
    expect(papeisDoSetor("PEDAGOGICO")).toEqual([Papel.GERENTE_PEDAGOGICO, Papel.PROFESSOR]);
  });
  it("multi-papel é a união sem repetição", () => {
    expect(setoresVisiveisNoInbox([Papel.VENDEDOR, Papel.GERENTE_COMERCIAL])).toEqual(["COMERCIAL"]);
    expect(setoresVisiveisNoInbox([Papel.VENDEDOR, Papel.FINANCEIRO])).toEqual(["COMERCIAL", "FINANCEIRO"]);
  });
  it("ordem de saida independe da ordem dos papeis", () => {
    expect(setoresVisiveisNoInbox([Papel.FINANCEIRO, Papel.VENDEDOR])).toEqual(["COMERCIAL", "FINANCEIRO"]);
    expect(setoresVisiveisNoInbox([Papel.VENDEDOR, Papel.FINANCEIRO])).toEqual(["COMERCIAL", "FINANCEIRO"]);
    expect(setoresVisiveisNoInbox([Papel.SECRETARIA_ACADEMICA, Papel.VENDEDOR])).toEqual(["SECRETARIA", "COMERCIAL", "FINANCEIRO", "PEDAGOGICO"]);
    expect(setoresVisiveisNoInbox([Papel.VENDEDOR, Papel.SECRETARIA_ACADEMICA])).toEqual(["SECRETARIA", "COMERCIAL", "FINANCEIRO", "PEDAGOGICO"]);
  });
  it("inbox x CRM: a base vem do CRM; as diferenças são só PROFESSOR e a Q1 da Secretaria", () => {
    for (const p of Object.values(Papel)) {
      const crm = setoresCrmDoUsuario([p]);
      const inbox = setoresVisiveisNoInbox([p]);
      for (const s of crm) expect(inbox, p).toContain(s);
      const extras = inbox.filter((s) => !crm.includes(s));
      if (p === Papel.PROFESSOR) expect(extras).toEqual(["PEDAGOGICO"]);
      else if (p === Papel.SECRETARIA_ACADEMICA) expect(extras).toEqual(["FINANCEIRO", "PEDAGOGICO"]);
      else expect(extras, p).toEqual([]);
    }
  });
  it("triagem: papéis dos setores do número, sem PROFESSOR, ALUNO nem ADMINISTRADOR", () => {
    expect(papeisDeTriagem(["SECRETARIA", "FINANCEIRO"])).toEqual([Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA]);
    expect(papeisDeTriagem(["COMERCIAL", "PEDAGOGICO"])).toEqual([Papel.GERENTE_COMERCIAL, Papel.VENDEDOR, Papel.GERENTE_PEDAGOGICO]);
    expect(podeTriarSetores([Papel.SECRETARIA_ACADEMICA], ["SECRETARIA", "FINANCEIRO"])).toBe(true);
    expect(podeTriarSetores([Papel.SECRETARIA_ACADEMICA], ["COMERCIAL", "FINANCEIRO"])).toBe(false);
    expect(podeTriarSetores([Papel.PROFESSOR], ["COMERCIAL", "PEDAGOGICO"])).toBe(false);
    expect(podeTriarSetores([Papel.ALUNO, Papel.ADMINISTRADOR], [...SETORES])).toBe(false);
  });
});
