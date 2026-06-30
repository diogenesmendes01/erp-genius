import { describe, it, expect } from "vitest";
import {
  chaveDoCabecalhoTurma,
  resolverBool,
  resolverData,
  resolverDiasSemana,
  resolverModalidade,
  resolverNivel,
  resolverProfessor,
} from "./importacao";

describe("importação de turmas — parsers", () => {
  it("mapeia cabeçalhos (acento, caixa, dica de formato)", () => {
    expect(chaveDoCabecalhoTurma("Modalidade")).toBe("modalidade");
    expect(chaveDoCabecalhoTurma("NÍVEL")).toBe("nivel");
    expect(chaveDoCabecalhoTurma("Dias da semana (ex.: Seg, Qua, Sex)")).toBe("diasSemana");
    expect(chaveDoCabecalhoTurma("Horário de início (HH:MM)")).toBe("horarioInicio");
    expect(chaveDoCabecalhoTurma("coluna inexistente")).toBeNull();
  });

  it("reimporta o próprio modelo: cabeçalho com sufixo obrigatório ' *' casa", () => {
    // O modelo gera "Modalidade *", "Data de início (AAAA-MM-DD) *" etc.
    expect(chaveDoCabecalhoTurma("Modalidade *")).toBe("modalidade");
    expect(chaveDoCabecalhoTurma("Nível *")).toBe("nivel");
    expect(chaveDoCabecalhoTurma("Dias da semana (ex.: Seg, Qua, Sex) *")).toBe("diasSemana");
    expect(chaveDoCabecalhoTurma("Data de início (AAAA-MM-DD) *")).toBe("dataInicio");
    expect(chaveDoCabecalhoTurma("Data de fim (AAAA-MM-DD) *")).toBe("dataFim");
  });

  it("resolve dias da semana de várias grafias (sem dígito cru ambíguo)", () => {
    expect(resolverDiasSemana("Seg, Qua, Sex")).toEqual([1, 3, 5]);
    expect(resolverDiasSemana("segunda/quarta/sexta")).toEqual([1, 3, 5]);
    expect(resolverDiasSemana("Seg-Qua-Sex")).toEqual([1, 3, 5]);
    expect(resolverDiasSemana("Seg.Qua.Sex")).toEqual([1, 3, 5]);
    expect(resolverDiasSemana("Terça e Quinta")).toEqual([2, 4]);
    expect(resolverDiasSemana("2ª, 4ª, 6ª")).toEqual([1, 3, 5]); // ordinal BR
    expect(resolverDiasSemana("Sáb, Dom")).toEqual([0, 6]);
    expect(resolverDiasSemana("Seg, Seg")).toEqual([1]); // sem duplicados
    expect(resolverDiasSemana("")).toEqual([]);
    expect(resolverDiasSemana("1,3,5")).toEqual([]); // dígito cru NÃO é aceito (ambíguo)
  });

  it("expande faixas (Segunda a Sexta)", () => {
    expect(resolverDiasSemana("Segunda a Sexta")).toEqual([1, 2, 3, 4, 5]);
    expect(resolverDiasSemana("Seg até Qua")).toEqual([1, 2, 3]);
  });

  it("resolve sim/não e datas", () => {
    expect(resolverBool("Sim")).toBe(true);
    expect(resolverBool("não")).toBe(false);
    expect(resolverBool("")).toBeUndefined();
    expect(resolverData("2026-08-01")?.getFullYear()).toBe(2026);
    expect(resolverData("")).toBeNull();
  });

  it("resolve modalidade por nome", () => {
    const mods = [{ id: "m1", nome: "Intensiva" }, { id: "m2", nome: "Semi-intensiva" }];
    expect(resolverModalidade("intensiva", mods)?.id).toBe("m1");
    expect(resolverModalidade("Semi-intensiva", mods)?.id).toBe("m2");
    expect(resolverModalidade("Semi intensiva", mods)?.id).toBe("m2"); // tolera espaço × hífen
    expect(resolverModalidade("inexistente", mods)).toBeNull();
  });

  it("resolve nível por código ou rótulo completo", () => {
    const niveis = [{ id: "n1", codigo: "A1", idioma: { nome: "Português" } }];
    expect(resolverNivel("A1", niveis)?.id).toBe("n1"); // código nu OK quando único
    expect(resolverNivel("Português A1", niveis)?.id).toBe("n1");
    expect(resolverNivel("B2", niveis)).toBeNull();
  });

  it("código nu AMBÍGUO entre idiomas retorna null; rótulo completo desambígua", () => {
    const niveis = [
      { id: "pt", codigo: "A1", idioma: { nome: "Português" } },
      { id: "en", codigo: "A1", idioma: { nome: "Inglês" } },
    ];
    expect(resolverNivel("A1", niveis)).toBeNull(); // ambíguo → não casa o primeiro
    expect(resolverNivel("Português A1", niveis)?.id).toBe("pt");
    expect(resolverNivel("Inglês A1", niveis)?.id).toBe("en");
  });

  it("resolve professor por nome ou e-mail; vazio = null", () => {
    const profs = [{ id: "u1", nome: "Carla Fernández", email: "carla@genius.com" }];
    expect(resolverProfessor("carla fernandez", profs)?.id).toBe("u1");
    expect(resolverProfessor("carla@genius.com", profs)?.id).toBe("u1");
    expect(resolverProfessor("", profs)).toBeNull();
  });
});
