import { describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { capacidadesPainel, podeExecutar, TIPOS_DESVINCULAVEIS, type AcaoInbox, type ContextoAcao } from "./permissoes";

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
    [Papel.ADMINISTRADOR, "desvincular", { setor: "COMERCIAL" }, true], [Papel.ADMINISTRADOR, "desvincular", { setor: "FINANCEIRO" }, true],
    [Papel.ADMINISTRADOR, "desvincular", { setor: "SECRETARIA" }, true], [Papel.ADMINISTRADOR, "desvincular", { setor: "PEDAGOGICO" }, false],
    [Papel.GERENTE_COMERCIAL, "desvincular", { setor: "COMERCIAL" }, true], [Papel.GERENTE_COMERCIAL, "desvincular", { setor: "SECRETARIA" }, false],
    [Papel.GERENTE_COMERCIAL, "desvincular", { setor: "FINANCEIRO" }, false], [Papel.GERENTE_PEDAGOGICO, "desvincular", { setor: "PEDAGOGICO" }, false],
    [Papel.VENDEDOR, "desvincular", { setor: "COMERCIAL", responsavelId: "v1" }, false],
    [Papel.SECRETARIA_ACADEMICA, "desvincular", { setor: "SECRETARIA", responsavelId: "v1" }, false],
    [Papel.FINANCEIRO, "desvincular", { setor: "FINANCEIRO", responsavelId: "v1" }, false],
  ])("%s %s %o → %s", (papel, acao, ctx, esperado) =>
    expect(podeExecutar({ id: "v1", papeis: [papel] }, acao as AcaoInbox, { setor: "COMERCIAL", responsavelId: null, ...ctx } as ContextoAcao)).toBe(esperado));
});

describe("assumir em linha de vendas (C3 da revisão da 3C)", () => {
  const linha = (papel: Papel, id: string, donoLinhaId: string | null) =>
    podeExecutar({ id, papeis: [papel] }, "assumir", { setor: "COMERCIAL", responsavelId: null, linhaComercial: true, donoLinhaId });
  it("vendedor que não é o dono da linha não vê 'Assumir'; o dono, o gerente e o admin veem", () => {
    expect(linha(Papel.VENDEDOR, "v1", null)).toBe(false);
    expect(linha(Papel.VENDEDOR, "v1", "outro")).toBe(false);
    expect(linha(Papel.VENDEDOR, "v1", "v1")).toBe(true);
    expect(linha(Papel.GERENTE_COMERCIAL, "g1", null)).toBe(true);
    expect(linha(Papel.ADMINISTRADOR, "a1", null)).toBe(true);
  });
  it("fora de linha de vendas o vendedor assume da fila como antes", () => {
    expect(podeExecutar({ id: "v1", papeis: [Papel.VENDEDOR] }, "assumir", { setor: "COMERCIAL", responsavelId: null, linhaComercial: false, donoLinhaId: null })).toBe(true);
  });
});

describe("vínculos que cada setor desfaz (D8)", () => {
  it("comercial desfaz a oportunidade; secretaria e financeiro, aluno e responsável; pedagógico nada", () => {
    expect(TIPOS_DESVINCULAVEIS).toEqual({ COMERCIAL: ["lead"], SECRETARIA: ["aluno", "responsavel"], FINANCEIRO: ["aluno", "responsavel"], PEDAGOGICO: [] });
  });
});


describe("projeção das capacidades do painel em contexto já autorizado", () => {
  const usuario = (...papeis: Papel[]) => ({ id: "u1", papeis });
  it("comercial com lead visível projeta edição do vendedor sem conceder configuração global da Aria", () => {
    expect(capacidadesPainel(usuario(Papel.VENDEDOR), { finalidade: "COMERCIAL", veLead: true })).toEqual({
      veLead: true, verContato: true, editarContato: true, editarTags: true, criarTag: false, moverEtapa: true,
      tarefas: true, tarefasEquipe: false, desfazerAria: false, verEmpresa: false,
    });
  });
  it("lead invisível não libera edição/tag/etapa/Aria nem mesmo ao administrador", () => {
    for (const papel of [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.ADMINISTRADOR]) {
      expect(capacidadesPainel(usuario(papel), { finalidade: "COMERCIAL", veLead: false })).toMatchObject({
        veLead: false, editarContato: false, editarTags: false, criarTag: false, moverEtapa: false, desfazerAria: false,
      });
    }
  });
  it("gerente comercial conserva matriz CRM/Aria sem receber acesso à empresa", () => {
    expect(capacidadesPainel(usuario(Papel.GERENTE_COMERCIAL), { finalidade: "COMERCIAL", veLead: true })).toEqual({
      veLead: true, verContato: true, editarContato: true, editarTags: true, criarTag: true, moverEtapa: true,
      tarefas: true, tarefasEquipe: true, desfazerAria: true, verEmpresa: false,
    });
  });
  it("administrador conserva as capacidades dos produtores em comercial autorizado", () => {
    expect(capacidadesPainel(usuario(Papel.ADMINISTRADOR), { finalidade: "COMERCIAL", veLead: true })).toEqual({
      veLead: true, verContato: true, editarContato: true, editarTags: true, criarTag: true, moverEtapa: true,
      tarefas: true, tarefasEquipe: true, desfazerAria: true, verEmpresa: true,
    });
  });
  it.each(["FINANCEIRO", "SECRETARIA", "PEDAGOGICO"] as const)("D13: %s não recebe ações comerciais pela presença de lead", finalidade => {
    expect(capacidadesPainel(usuario(Papel.ADMINISTRADOR), { finalidade, veLead: true })).toMatchObject({
      veLead: true, editarContato: false, editarTags: false, criarTag: false, moverEtapa: false, desfazerAria: false,
    });
  });
  it("financeiro tem tarefas e empresa, sem contato/CRM comercial", () => {
    expect(capacidadesPainel(usuario(Papel.FINANCEIRO), { finalidade: "FINANCEIRO", veLead: false })).toEqual({
      veLead: false, verContato: false, editarContato: false, editarTags: false, criarTag: false, moverEtapa: false,
      tarefas: true, tarefasEquipe: false, desfazerAria: false, verEmpresa: true,
    });
  });
  it("secretaria conserva leitura de contato/tarefas sem edição comercial nem empresa", () => {
    expect(capacidadesPainel(usuario(Papel.SECRETARIA_ACADEMICA), { finalidade: "SECRETARIA", veLead: false })).toEqual({
      veLead: false, verContato: true, editarContato: false, editarTags: false, criarTag: false, moverEtapa: false,
      tarefas: true, tarefasEquipe: false, desfazerAria: false, verEmpresa: false,
    });
  });
  it.each([Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO, Papel.ALUNO])("%s não ganha tarefas ou ações CRM", papel => {
    expect(capacidadesPainel(usuario(papel), { finalidade: "PEDAGOGICO", veLead: false })).toEqual({
      veLead: false, verContato: false, editarContato: false, editarTags: false, criarTag: false, moverEtapa: false,
      tarefas: false, tarefasEquipe: false, desfazerAria: false, verEmpresa: false,
    });
  });
  it("papéis acumulados unem capacidades atuais, sem elevar vendedor à configuração Aria", () => {
    expect(capacidadesPainel(usuario(Papel.VENDEDOR, Papel.FINANCEIRO), { finalidade: "COMERCIAL", veLead: true })).toMatchObject({
      editarContato: true, moverEtapa: true, criarTag: false, tarefasEquipe: false, desfazerAria: false, verEmpresa: true,
    });
  });
});
