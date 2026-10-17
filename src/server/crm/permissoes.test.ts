import { describe, expect, it } from "vitest";
import { Papel } from "@prisma/client";
import { capacidadesCrm, exigirCapacidadeCrm, setoresDoUsuario } from "./permissoes";

const caps = (...p: Papel[]) => [...capacidadesCrm(p)].sort();

describe("permissões do CRM", () => {
  it("matriz por papel", () => {
    expect(caps(Papel.ADMINISTRADOR)).toHaveLength(14);
    expect(caps(Papel.VENDEDOR)).toEqual(["comissoes.ver", "contatos.editar", "contatos.ver", "funil.mover", "funil.ver", "tarefas.ver"]);
    expect(caps(Papel.GERENTE_COMERCIAL)).toEqual(["carteira.coberturas", "carteira.equipe", "comissoes.equipe", "comissoes.ver", "contatos.editar", "contatos.importar", "contatos.mesclar", "contatos.ver", "funil.atribuir", "funil.mover", "funil.ver", "tarefas.equipe", "tarefas.ver"]);
    expect(caps(Papel.FINANCEIRO)).toEqual(["comissoes.equipe", "comissoes.estornar", "comissoes.ver", "tarefas.ver"]);
    expect(caps(Papel.SECRETARIA_ACADEMICA)).toEqual(["contatos.ver", "tarefas.ver"]);
    for (const p of [Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO, Papel.ALUNO]) expect(caps(p)).toEqual([]);
  });
  it("multipapel soma", () => {
    expect(capacidadesCrm([Papel.VENDEDOR, Papel.FINANCEIRO]).has("comissoes.estornar")).toBe(true);
  });
  it("setor vem do papel (doc 02 E3.2)", () => {
    expect(setoresDoUsuario([Papel.VENDEDOR])).toEqual(["COMERCIAL"]);
    expect(setoresDoUsuario([Papel.ADMINISTRADOR])).toEqual(["COMERCIAL", "FINANCEIRO", "SECRETARIA", "PEDAGOGICO"]);
    expect(setoresDoUsuario([Papel.SECRETARIA_ACADEMICA])).toEqual(["SECRETARIA"]);
  });
  it("exigirCapacidadeCrm lança ErroPermissao sem a capacidade", () => {
    const u = { id: "u1", nome: "U", papeis: [Papel.VENDEDOR] };
    expect(() => exigirCapacidadeCrm(u, "funil.ver")).not.toThrow();
    expect(() => exigirCapacidadeCrm(u, "comissoes.estornar")).toThrow("Você não tem acesso a esta função do CRM.");
  });
});
