import { describe, it, expect } from "vitest";
import { Genero, Escolaridade } from "@prisma/client";
import {
  chaveDoCabecalho,
  resolverGenero,
  resolverEscolaridade,
  resolverBool,
  resolverISO,
  resolverData,
} from "./importacao";

describe("importação de alunos — parsers", () => {
  it("mapeia cabeçalhos (com acento, caixa e dica de formato)", () => {
    expect(chaveDoCabecalho("Nome")).toBe("primeiroNome");
    expect(chaveDoCabecalho("PAÍS")).toBe("pais");
    expect(chaveDoCabecalho("Data de nascimento (AAAA-MM-DD)")).toBe("nascimento");
    expect(chaveDoCabecalho("coluna inexistente")).toBeNull();
  });

  it("reimporta o próprio modelo: cabeçalho obrigatório com ' *' casa", () => {
    // O modelo gera "Nome *", "País *" — precisam casar na reimportação.
    expect(chaveDoCabecalho("Nome *")).toBe("primeiroNome");
    expect(chaveDoCabecalho("País *")).toBe("pais");
  });

  it("resolve gênero por rótulo e abreviação", () => {
    expect(resolverGenero("Masculino")).toBe(Genero.MASCULINO);
    expect(resolverGenero("F")).toBe(Genero.FEMININO);
    expect(resolverGenero("Prefiro não informar")).toBe(Genero.NAO_INFORMADO);
    expect(resolverGenero("")).toBeNull();
  });

  it("resolve escolaridade por rótulo", () => {
    expect(resolverEscolaridade("Superior completo")).toBe(Escolaridade.SUPERIOR_COMPLETO);
    expect(resolverEscolaridade("xyz")).toBeNull();
  });

  it("resolve sim/não para boolean (vazio = undefined)", () => {
    expect(resolverBool("sim")).toBe(true);
    expect(resolverBool("Não")).toBe(false);
    expect(resolverBool("")).toBeUndefined();
  });

  it("resolve país ISO por código ou nome", () => {
    expect(resolverISO("CR")).toBe("CR");
    expect(resolverISO("Venezuela")).toBe("VE");
    expect(resolverISO("paisinexistente")).toBeNull();
    expect(resolverISO("")).toBeNull();
  });

  it("resolve data AAAA-MM-DD para meio-dia local", () => {
    const d = resolverData("1998-04-12");
    expect(d?.getFullYear()).toBe(1998);
    expect(d?.getMonth()).toBe(3);
    expect(d?.getDate()).toBe(12);
    expect(resolverData("")).toBeNull();
  });
});
