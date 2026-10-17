import { describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { podeExecutar, type AcaoInbox, type ContextoAcao } from "./permissoes";

describe("matriz de permissões do Inbox (doc 03)", () => {
  it.each([
    [Papel.VENDEDOR, "editarApagar", { autorMensagemId: "v1" }, true],
    [Papel.VENDEDOR, "editarApagar", { autorMensagemId: "outro" }, false],
    [Papel.ADMINISTRADOR, "editarApagar", { autorMensagemId: "outro" }, false],
    [Papel.VENDEDOR, "bloquear", {}, false], [Papel.GERENTE_COMERCIAL, "bloquear", {}, true],
    [Papel.SECRETARIA_ACADEMICA, "grupoGerir", {}, true], [Papel.FINANCEIRO, "grupoGerir", {}, false],
    [Papel.GERENTE_COMERCIAL, "perfilNumero", {}, false], [Papel.ADMINISTRADOR, "perfilNumero", {}, true],
    [Papel.VENDEDOR, "encerrar", { setor: "COMERCIAL" }, false], [Papel.GERENTE_COMERCIAL, "encerrar", { setor: "COMERCIAL" }, true],
    [Papel.FINANCEIRO, "encerrar", { setor: "FINANCEIRO" }, true], [Papel.SECRETARIA_ACADEMICA, "encerrar", { setor: "PEDAGOGICO" }, true],
    [Papel.FINANCEIRO, "encerrar", { setor: "COMERCIAL" }, false],
    [Papel.GERENTE_PEDAGOGICO, "encerrar", { setor: "PEDAGOGICO" }, true],
    [Papel.SECRETARIA_ACADEMICA, "encerrar", { setor: "SECRETARIA" }, true],
    [Papel.VENDEDOR, "atribuir", { setor: "COMERCIAL" }, false], [Papel.GERENTE_COMERCIAL, "atribuir", { setor: "COMERCIAL" }, true],
    [Papel.GERENTE_COMERCIAL, "atribuir", { setor: "FINANCEIRO" }, false], [Papel.ADMINISTRADOR, "atribuir", { setor: "FINANCEIRO" }, true],
    [Papel.VENDEDOR, "transferir", { setor: "COMERCIAL", responsavelId: "v1" }, true],
    [Papel.VENDEDOR, "transferir", { setor: "COMERCIAL", responsavelId: "outro" }, false],
    [Papel.GERENTE_COMERCIAL, "transferir", { setor: "COMERCIAL", responsavelId: "outro" }, true],
    [Papel.VENDEDOR, "convidar", { setor: "COMERCIAL", responsavelId: "v1" }, true],
    [Papel.VENDEDOR, "convidar", { setor: "COMERCIAL", responsavelId: "outro" }, false],
    [Papel.VENDEDOR, "devolver", { setor: "COMERCIAL", responsavelId: "v1" }, true],
    [Papel.VENDEDOR, "devolver", { setor: "COMERCIAL", responsavelId: "outro" }, false],
    [Papel.VENDEDOR, "assumir", { setor: "COMERCIAL", responsavelId: null }, true],
    [Papel.VENDEDOR, "assumir", { setor: "COMERCIAL", responsavelId: "outro" }, false],
    [Papel.VENDEDOR, "assumir", { setor: "FINANCEIRO", responsavelId: null }, false],
    [Papel.PROFESSOR, "assumir", { setor: "PEDAGOGICO", responsavelId: null }, false],
    [Papel.PROFESSOR, "enviar", { setor: "PEDAGOGICO", participante: false }, true],
    [Papel.VENDEDOR, "encaminhar", {}, true], [Papel.VENDEDOR, "preferenciaPessoal", {}, true],
    [Papel.VENDEDOR, "notaInterna", {}, true], [Papel.VENDEDOR, "agendar", {}, true],
  ])("%s %s %o → %s", (papel, acao, ctx, esperado) =>
    expect(podeExecutar({ id: "v1", papeis: [papel] }, acao as AcaoInbox, { setor: "COMERCIAL", responsavelId: null, ...ctx } as ContextoAcao)).toBe(esperado));
});
